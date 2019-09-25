import { Board, BoardColumn, BoardColumnType } from "TFS/Work/Contracts";
import { WorkItem } from "TFS/WorkItemTracking/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { JsonPatchDocument, JsonPatchOperation, Operation } from "VSS/WebApi/Contracts";

import { getEnabledBoards, getOrderFieldName } from "./backlogConfiguration";
import { getBoard, getBoardReferences } from "./boardCache";
import { trackEvent } from "./events";
import { areaPathField, closedDateField, projectField, stateField, witField } from "./fieldNames";
import { fillEmptyOrderByValues } from "./fillEmptyOrderbyValues";
import { getTeamsForAreaPathFromCache } from "./locateTeam/teamNodeCache";
import { Timings } from "./timings";
import { getStatus, setStatus } from "./tryExecute";
import { getWorkItem } from "./batch/BatchedWorkItems";

interface ITeamBoard {
    teamName: string;
    board?: Board;
    haveWiData?: boolean;
}

export interface IPosition {
    isClosed: boolean;
    val: number;
    total: number;
}

export interface IBoardOptions {
    location: string;
    knownTeam?: string;
    readonly?: boolean;
    batchWindow?: number;
    partialWi?: {[refName: string]: Object};
}

let firstRefresh = true;
export class BoardModel {
    public static async create(id: number, options: IBoardOptions): Promise<BoardModel> {
        const boardModel = new BoardModel(options);
        await boardModel.refresh(id);
        return boardModel;
    }
    public getBoard(team?: string) {
        const teamBoard = this.getTeamBoard(team);
        return teamBoard && teamBoard.board;
    };
    public getBoardIds() {
        return this.boards.map(b => b.board.id);
    }
    public getColumn(team?: string) {
        const board = this.getBoard(team);
        return board && this.workItem.fields[board.fields.columnField.referenceName];
    };
    public getRow(team?: string) {
        const board = this.getBoard(team);
        return board && this.workItem.fields[board.fields.rowField.referenceName];
    };
    public getDoing(team?: string) {
        const board = this.getBoard(team);
        return board && this.workItem.fields[board.fields.doneField.referenceName];
    };
    public getTeams(): string[] {
        return this.boards.map(b => b.teamName);
    }

    public estimatedTeam() {
        const board = this.getTeamBoard("");
        return board && board.teamName;
    };
    private getTeamBoard(team: string) {
        if (team) {
            return this.boards.filter(b => b.teamName === team)[0];
        }
        const boards = this.boards.reverse();
        if (!this.workItem) {
            return undefined;
        }
        const areaParts = this.workItem.fields[areaPathField].split("\\");
        let boardByAreaPath: ITeamBoard | undefined = undefined;
        while (!boardByAreaPath && areaParts.length > 0) {
            const areaPart = areaParts.pop();
            boardByAreaPath = boards.filter(b => b.teamName === areaPart)[0];
        }
        return boardByAreaPath || boards[0];
    };
    public getValidColumns(team: string): BoardColumn[] {
        const teamBoard = this.getTeamBoard(team);
        if (!teamBoard) {
            return [];
        }
        return teamBoard.board.columns;
    }
    public projectName: string;

    private boards: ITeamBoard[];
    private teams: string[];
    private refreshTimings: Timings;
    private fieldTimings: Timings = new Timings();

    private workItem: WorkItem;
    private constructor(private readonly options: IBoardOptions) { }

    private completedRefresh() {
        this.refreshTimings.measure("totalTime", false);
        const fields = this.workItem ? this.workItem.fields : {};
        trackEvent("boardRefresh", {
            location: this.options.location,
            teamCount: String(this.teams.length),
            foundBoard: String(!!this.getBoard()),
            matchingBoards: String(this.boards.length),
            wiHasBoardData: String(!!this.getColumn()),
            host: VSS.getWebContext().host.authority,
            firstRefresh: String(firstRefresh),
            boardDatasOnWi: String(Object.keys(fields).filter(f => f.match("_Kanban.Column$")).length)
        }, this.refreshTimings.measurements);
        firstRefresh = false;
    }

    private createRefreshTimings() {
        const windowStart = window["start"];
        if (firstRefresh && typeof windowStart === "number") {
            const timings = new Timings(windowStart);
            timings.measure("startRefresh");
            return timings;
        } else {
            return new Timings();
        }
    }

    public async refresh(workItemId: number): Promise<void> {
        this.refreshTimings = this.createRefreshTimings();
        this.boards = [];

        const getTeams = async (skipCache?: string): Promise<string[]> => {
            if (this.options.knownTeam) {
                return [this.options.knownTeam];
            }
            let project: string;
            let areapath: string;
            const {partialWi} = this.options;
            if (partialWi && partialWi[areaPathField] && partialWi[projectField]) {
                project = partialWi[projectField] as string;
                areapath = partialWi[areaPathField] as string;
            } else {
                const {fields} = await wiPromise;
                project = fields[projectField];
                areapath = fields[areaPathField];
            }
            setStatus("getting teams...");
            const teams = await getTeamsForAreaPathFromCache(project, areapath, skipCache);
            return teams.map(({name}) => name);
        };
        const getIsBoardEnabled = async (team: string) => {
            if (this.options.knownTeam) {
                return () => true;
            }
            return await getEnabledBoards(this.projectName, team);
        }
        let wiPromise: Promise<WorkItem>;
        try {
            setStatus("getting webcontext...");
            const { project } = VSS.getWebContext();
            // if on the form we can get the full work item and the possible teams at the same time
            wiPromise = getWorkItem(workItemId, this.options.readonly && project.name, this.options.batchWindow);
            const teams = await getTeams();
            this.refreshTimings.measure("cacheRead");
            this.teams = teams;
            if (teams.length === 0) {
                this.completedRefresh();
                return;
            }
            setStatus("getting workItem...");
            const wi = await wiPromise;
            this.refreshTimings.measure("getWorkItem");
            this.workItem = wi;
            this.projectName = wi.fields[projectField];
            try {
                const teamBoards = await Promise.all(teams.map(async (team) => {
                    setStatus("getting board references & backlog configuration...");
                    const [references, isBoardEnabled] = await Promise.all([
                        getBoardReferences(this.projectName, team),
                        getIsBoardEnabled(team),
                    ]);
                    setStatus("getting boards...");
                    const boards = await Promise.all(references.filter(r => isBoardEnabled(r.name))
                        .map(r => getBoard(this.projectName, team, r.id)));
                    return this.findAssociatedBoard(team, boards);
                }));
                this.refreshTimings.measure("getAllBoards");

                this.boards = teamBoards.filter(t => t.haveWiData);
                this.completedRefresh();
            } catch (e) {
                if (e.status === 404 && e.message.indexOf("The team with id") >= 0) {
                    getTeams("team not found");
                    return this.refresh(workItemId);
                }
                throw e;
            }
        } catch (e) {
            trackEvent("refreshFailure", {message: e.message, stack: e.stack, status: getStatus()});
        } finally {
            setStatus("");
        }
    }

    private findAssociatedBoard(teamName: string, boards: Board[]): ITeamBoard {
        const state = this.workItem.fields[stateField];
        const [board] = boards.filter(b => {
            return this.getAllowedStates(b, this.workItem.fields[witField]).indexOf(state) >= 0;
        });
        return {
            teamName,
            board,
            haveWiData: !!board && board.fields.columnField.referenceName in this.workItem.fields
        };
    }
    public async save(team: string | undefined, field: "columnField" | "rowField", val: string): Promise<void>;
    public async save(team: string | undefined, field: "doneField", val: boolean): Promise<void>;
    public async save(team: string | undefined, field: "columnField" | "rowField" | "doneField", val: string | boolean): Promise<void> {
        if (!team) {
            team = this.estimatedTeam();
        }
        if (!this.getBoard(team)) {
            console.warn(`Save called on ${field} with ${val} when board not set`);
            trackEvent("saveError", { field, location: this.options.location });
            return;
        }
        this.fieldTimings.measure("timeToClick");
        trackEvent("UpdateBoardField", { field, location: this.options.location }, this.fieldTimings.measurements);
        const patchDocument: JsonPatchDocument & JsonPatchOperation[] = [];
        if (field === "rowField" && !val) {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Remove,
                path: `/fields/${this.getBoard(team).fields[field].referenceName}`
            });
        } else {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Add,
                path: `/fields/${this.getBoard(team).fields[field].referenceName}`,
                value: val
            });
        }
        setStatus("saving workitem...");
        const workItem = await getWITClient().updateWorkItem(patchDocument, this.workItem.id);
            this.workItem = workItem;
    }
    private getAllowedStates({allowedMappings}: Board, witName = ""): string[] {
        const states: string[] = [];
        for (const columnGroup in allowedMappings) {
            for (const mappedWit in allowedMappings[columnGroup]) {
                if (witName && witName !== mappedWit) {
                    continue;
                }
                states.push(...allowedMappings[columnGroup][mappedWit]);
            }
        }
        return states;
    }

    public async getColumnIndex(team: string = "", move?: "move to top" | "move to bottom"): Promise<IPosition> {
        const {board} = this.getTeamBoard(team);
        const {columnField, doneField, rowField} = board.fields;
        const colName = columnField.referenceName;
        const doneName = doneField.referenceName;
        const rowName = rowField.referenceName;
        const {fields} = this.workItem;
        const wits = Object.keys(board.columns[0].stateMappings)
        const [column] = board.columns.filter((c) => c.name === fields[colName]);
        const orderFieldName =  await getOrderFieldName(fields[projectField]);
        const query = `
SELECT
        System.Id
FROM workitems
WHERE
        [System.TeamProject] = "${fields[projectField]}"
        and System.AreaPath = "${fields[areaPathField]}"
        and ${witField} in (${wits.map((s) => `'${s}'`).join(",")})
        and ${stateField} in (${this.getAllowedStates(board).map((s) => `'${s}'`).join(",")})
        and ${colName} = "${fields[colName]}"
        ${
            column.isSplit ?
            `and ${doneName} = ${fields[doneName] || false}` : ""
        }
        ${
            column.columnType === BoardColumnType.InProgress ?
            `and ${rowName} = "${fields[rowName] || ""}"` : ""
        }
ORDER BY ${column.columnType === BoardColumnType.Outgoing ? `${closedDateField} DESC` : orderFieldName}, ID
`;
        setStatus("querying for column index...");
        const results = await getWITClient().queryByWiql({query});
        const ids = results.workItems.map(({id}) => id);
        if (ids.length < 0) {
            return {val: -1, total: 0} as IPosition;
        }
        const pos: IPosition = {
            val: ids.indexOf(this.workItem.id),
            total: ids.length,
            isClosed: column.columnType === BoardColumnType.Outgoing,

        };
        if (!move || (move === "move to top" && pos.val === 0)) {
            return pos;
        }
        trackEvent("UpdateBoardField", { field: "colPos", move, location: this.options.location });
        const idx = move === "move to top" ? 0 : ids.length - 1;
        setStatus(`get column index in order to ${move}...`);
        const wi = await getWITClient().getWorkItem(ids[idx], [areaPathField, orderFieldName, colName]);
        const offset = move === "move to top" ? -1 : 1;

        let currentOrderValue = wi.fields[orderFieldName]
        if (!currentOrderValue) {
            const {min, max} = await fillEmptyOrderByValues(
                orderFieldName, wi.fields[areaPathField], wits, colName, fields[colName]
            );
            currentOrderValue = move === "move to top" ? min : max;
        }
        const newStackRank = currentOrderValue + offset;
        const update: JsonPatchDocument & JsonPatchOperation[] = [{
            op: Operation.Add,
            path: `/fields/${orderFieldName}`,
            value: newStackRank,
        } as JsonPatchOperation];
        setStatus("updating work item column index");
        const updatedWi = await getWITClient().updateWorkItem(update, this.workItem.id);
        this.workItem = updatedWi;
        return pos;
    }
}