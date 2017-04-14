import { getBoard, getBoardReferences } from "./boardCache";
import { Board, BoardReference } from "TFS/Work/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItem } from "TFS/WorkItemTracking/Contracts";
import { JsonPatchDocument, JsonPatchOperation, Operation } from "VSS/WebApi/Contracts";
import Q = require("q");
import { ITeam } from "./locateTeam/teamNode";
import { getTeamsForAreaPathFromCache } from "./locateTeam/teamNodeCache";
import { trackEvent } from "./events";
import { Timings } from "./timings";

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
    public getBoard = () => this.boards.length === 0 ? undefined : this.boards[this.boards.length - 1].board;
    public getColumn = () => this.getBoard() && this.workItem.fields[this.getBoard().fields.columnField.referenceName];
    public getRow = () => this.getBoard() && this.workItem.fields[this.getBoard().fields.rowField.referenceName];
    public getDoing = () => this.getBoard() && Boolean(this.workItem.fields[this.getBoard().fields.doneField.referenceName]);
    public getTeamName = () => this.boards.length === 0 ? undefined : this.boards[this.boards.length - 1].teamName;
    public projectName: string;

    private boards: ITeamBoard[];
    private teams: ITeam[];
    private foundBoard: boolean;
    private refreshTimings: Timings;
    private fieldTimings: Timings = new Timings();
    private teamName: string;

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
                const lastTeam = teams[teams.length - 1];
                this.projectName = wi.fields[projectField];
                return Q.all(teams.map(t => getBoardReferences(this.projectName, t.name).then(
                    references => {
                        return Q.all(references.map(r => getBoard(this.projectName, t.name, r.id))).then(boards => {
                            return this.findAssociatedBoard(t.name, boards);
                        })
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
    public save(field: "columnField" | "rowField", val: string): IPromise<void>;
    public save(field: "doneField", val: boolean): IPromise<void>;
    public save(field: "columnField" | "rowField" | "doneField", val: string | boolean): IPromise<void> {
        if (!this.getBoard()) {
            console.warn(`Save called on ${field} with ${val} when board not set`);
            return Q(null).then(() => void 0);
        }
        this.fieldTimings.measure("timeToClick");
        trackEvent("UpdateBoardField", { field, location: this.location }, this.fieldTimings.measurements);
        const patchDocument: JsonPatchDocument & JsonPatchOperation[] = [];
        if (field === "rowField" && !val) {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Remove,
                path: `/fields/${this.getBoard().fields[field].referenceName}`
            });
        } else {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Add,
                path: `/fields/${this.getBoard().fields[field].referenceName}`,
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