import { getBoard, getBoardReferences } from "./boardCache";
import { Board, BoardColumn } from "TFS/Work/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItem, WorkItemType } from "TFS/WorkItemTracking/Contracts";
import { JsonPatchDocument, JsonPatchOperation, Operation } from "VSS/WebApi/Contracts";
import Q = require("q");
import { ITeam } from "./locateTeam/teamNode";
import { getTeamsForAreaPathFromCache } from "./locateTeam/teamNodeCache";
import { trackEvent } from "./events";
import { Timings } from "./timings";
import { getEnabledBoards } from "./backlogConfiguration";
import { getWorkItemType } from "./workItemType";

const projectField = "System.TeamProject";
const witField = "System.WorkItemType";
const areaPathField = "System.AreaPath";
const stateField = "System.State";
const stackRankField = "Microsoft.VSTS.Common.StackRank";

interface ITeamBoard {
    teamName: string;
    board?: Board;
    haveWiData?: boolean;
}

export interface IPosition {
    val: number;
    total: number;
}

let firstRefresh = true;
export class BoardModel {
    public static create(id: number, location: string, team?: string): IPromise<BoardModel> {
        const boardModel = new BoardModel(location, team);
        return boardModel.refresh(id).then(() => boardModel);
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
    private workItemType: WorkItemType;
    private constructor(readonly location: string, readonly knownTeam: string) { }

    private completedRefresh() {
        this.refreshTimings.measure("totalTime", false);
        trackEvent("boardRefresh", {
            location: this.location,
            teamCount: String(this.teams.length),
            foundBoard: String(!!this.getBoard()),
            matchingBoards: String(this.boards.length),
            wiHasBoardData: String(!!this.getColumn()),
            host: VSS.getWebContext().host.authority,
            firstRefresh: String(firstRefresh),
            boardDatasOnWi: String(Object.keys(this.workItem.fields).filter(f => f.match("_Kanban.Column$")).length)
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

    public refresh(workItemId: number): IPromise<void> {
        this.refreshTimings = this.createRefreshTimings();
        this.boards = [];
        
        const getTeams = () => {
            if (this.knownTeam) {
                return Q([this.knownTeam]);
            }
            return getTeamsForAreaPathFromCache(this.projectName, this.workItem.fields[areaPathField])
                .then(teams => teams.map(({name}) => name));
        };
        const getIsBoardEnabled = (team: string) => {
            if (this.knownTeam) {
                return Q(() => true);
            }
            return getEnabledBoards(this.projectName, team);
        }
        return getWITClient().getWorkItem(workItemId).then(wi => {
            this.refreshTimings.measure("getWorkItem");
            this.workItem = wi;
            this.projectName = wi.fields[projectField];
            return Q.all(
                [
                    getTeams(),
                ]
            ).then(([teams]) => {
                this.refreshTimings.measure("cacheRead");
                this.teams = teams;
                if (teams.length === 0) {
                    this.completedRefresh();
                    return;
                }
                return Q.all(teams.map(team => Q.all([
                    getBoardReferences(this.projectName, team),
                    getIsBoardEnabled(team),
                ]).then(
                    ([references, isBoardEnabled]) => {
                        return Q.all(references.filter(r => isBoardEnabled(r.name))
                            .map(r => getBoard(this.projectName, team, r.id)))
                            .then(boards => {
                                return this.findAssociatedBoard(team, boards);
                            });
                    }
                    ))).then(teamBoards => {
                        this.refreshTimings.measure("getAllBoards");

                        this.boards = teamBoards.filter(t => t.haveWiData);
                        this.completedRefresh();
                    });
            });
        });
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
    public save(team: string | undefined, field: "columnField" | "rowField", val: string): IPromise<void>;
    public save(team: string | undefined, field: "doneField", val: boolean): IPromise<void>;
    public save(team: string | undefined, field: "columnField" | "rowField" | "doneField", val: string | boolean): IPromise<void> {
        if (!team) {
            team = this.estimatedTeam();
        }
        if (!this.getBoard(team)) {
            console.warn(`Save called on ${field} with ${val} when board not set`);
            trackEvent("saveError", { field, location: this.location });
            return Q(null).then(() => void 0);
        }
        this.fieldTimings.measure("timeToClick");
        trackEvent("UpdateBoardField", { field, location: this.location }, this.fieldTimings.measurements);
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
        return getWITClient().updateWorkItem(patchDocument, this.workItem.id).then<void>(
            (workItem) => {
                this.workItem = workItem;
                return void 0;
            }
        );
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

    public getColumnIndex(team: string = "", move?: "move to top" | "move to bottom"): PromiseLike<IPosition> {
        const {board} = this.getTeamBoard(team);
        const {columnField, doneField, rowField} = board.fields;
        const colName = columnField.referenceName;
        const doneName = doneField.referenceName;
        const rowName = rowField.referenceName;
        const {fields} = this.workItem;
        const states = this.getAllowedStates(board);
        const workItemTypes = Object.keys(board.columns[0].stateMappings)
        const query = `
SELECT
        System.Id
FROM workitems
WHERE
        [System.TeamProject] = @project
        and System.AreaPath = "${fields[areaPathField]}"
        and ${colName} = "${fields[colName]}"
        and ${doneName} = ${fields[doneName] || false}
        and ${rowName} = "${fields[rowName] || ""}"
        and ${stateField} in (${states.map((s) => `'${s}'`).join(",")})
        and ${witField} in (${workItemTypes.map((s) => `'${s}'`).join(",")})
ORDER BY Microsoft.VSTS.Common.StackRank
`;
        return getWITClient().queryByWiql({query}, VSS.getWebContext().project.name).then((results) => {
            const ids = results.workItems.map(({id}) => id);
            if (ids.length < 0) {
                return Q({val: -1, total: 0} as IPosition);
            }
            const pos: IPosition = {val: ids.indexOf(this.workItem.id), total: ids.length};
            if (!move || (move === "move to top" && pos.val === 0)) {
                return Q(pos);
            }
            trackEvent("UpdateBoardField", { field: "colPos", move, location: this.location });
            const idx = move === "move to top" ? 0 : ids.length - 1;
            return getWITClient().getWorkItem(ids[idx], [stackRankField]).then((wi) => {
                const offset = move === "move to top" ? -1 : 1;
                const newStackRank = wi.fields[stackRankField] + offset;
                const update: JsonPatchDocument & JsonPatchOperation[] = [{
                    op: Operation.Add,
                    path: `/fields/${stackRankField}`,
                    value: newStackRank,
                } as JsonPatchOperation];
                return getWITClient().updateWorkItem(update, this.workItem.id).then((updatedWi) => {
                    this.workItem = updatedWi;
                    return pos;
                })
            })
        })
    }
}