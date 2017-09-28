import { getBoard, getBoardReferences } from "./boardCache";
import { Board } from "TFS/Work/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItem } from "TFS/WorkItemTracking/Contracts";
import { JsonPatchDocument, JsonPatchOperation, Operation } from "VSS/WebApi/Contracts";
import Q = require("q");
import { ITeam } from "./locateTeam/teamNode";
import { getTeamsForAreaPathFromCache } from "./locateTeam/teamNodeCache";
import { trackEvent } from "./events";
import { Timings } from "./timings";
import { getEnabledBoards } from "./backlogConfiguration";

const projectField = "System.TeamProject";
const witField = "System.WorkItemType";
const areaPathField = "System.AreaPath";

interface ITeamBoard {
    teamName: string;
    board?: Board;
    haveWiData?: boolean;
}

let firstRefresh = true;
export class BoardModel {
    public static create(id: number, location: string): IPromise<BoardModel> {
        const boardModel = new BoardModel(location);
        return boardModel.refresh(id).then(() => boardModel);
    }
    public getWorkItemId() {
        return this.workItem.id;
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
    public projectName: string;

    private boards: ITeamBoard[];
    private teams: ITeam[];
    private foundBoard: boolean;
    private refreshTimings: Timings;
    private fieldTimings: Timings = new Timings();

    private workItem: WorkItem;
    private workItemType: string;
    private constructor(readonly location) { }

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
        return getWITClient().getWorkItem(workItemId).then(wi => {
            this.refreshTimings.measure("getWorkItem");
            this.workItem = wi;
            this.workItemType = wi.fields[witField];
            return getTeamsForAreaPathFromCache(wi.fields[projectField], wi.fields[areaPathField]).then(teams => {
                this.refreshTimings.measure("cacheRead");
                this.teams = teams;
                if (teams.length === 0) {
                    this.completedRefresh();
                    return;
                }
                this.projectName = wi.fields[projectField];
                return Q.all(teams.map(t => Q.all([
                    getBoardReferences(this.projectName, t.name),
                    getEnabledBoards(this.projectName, t.name)
                ]).then(
                    ([references, enabledBoards]) => {
                        return Q.all(references.filter(r => enabledBoards.some(b => b === r.name))
                            .map(r => getBoard(this.projectName, t.name, r.id)))
                            .then(boards => {
                                return this.findAssociatedBoard(t.name, boards);
                            });
                    }
                    ))).then(teamBoards => {
                        this.refreshTimings.measure("getAllBoards");

                        const matchingBoards = teamBoards.filter(t => t.board);
                        this.foundBoard = matchingBoards.length > 0;
                        this.boards = teamBoards.filter(t => t.haveWiData);
                        this.completedRefresh();
                    });
            });
        });
    }

    private findAssociatedBoard(teamName: string, boards: Board[]): ITeamBoard {
        const [board] = boards.filter(b => {
            for (let key in b.allowedMappings) {
                return this.workItemType in b.allowedMappings[key];
            }
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
}