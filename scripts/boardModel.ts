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

const projectField = "System.TeamProject";
const witField = "System.WorkItemType";
const areaPathField = "System.AreaPath";

let firstRefresh = true;
export class BoardModel {
    public static create(id: number, location: string): IPromise<BoardModel> {
        const boardModel = new BoardModel(id, location);
        return boardModel.refresh().then(() => boardModel);
    }
    // TODO make Board | null;
    private board: Board;
    public getBoard = () => this.board;
    private boardColumn: string | undefined;
    public getColumn = () => this.boardColumn;
    private boardRow: string | undefined;
    public getRow = () => this.boardRow;
    private boardDoing: boolean | undefined;
    public getDoing = () => Boolean(this.boardDoing);
    public projectName: string;
    public teamName: string;

    private teams: ITeam[];
    private refreshTimings: Timings;
    private fieldTimings: Timings = new Timings();

    private workItem: WorkItem;
    private workItemType: string;
    private constructor(readonly id: number, readonly location) { }

    private completedRefresh() {
        this.refreshTimings.measure("totalTime", false);
        trackEvent("boardRefresh", {
            location: this.location,
            teamCount: String(this.teams.length),
            foundBoard: String(!!this.board),
            wiHasBoardData: String(!!this.boardColumn),
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

    public refresh(): IPromise<void> {
        this.refreshTimings = this.createRefreshTimings();
        delete this.board;
        this.boardColumn = this.boardRow = this.boardDoing = undefined;
        return getWITClient().getWorkItem(this.id).then(wi => {
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
                this.teamName = lastTeam.name;
                return getBoardReferences(this.projectName, this.teamName).then(
                    (boardReferences) => {
                        this.refreshTimings.measure("teamBoards");
                        return Q.all(boardReferences.map(b => getBoard(this.projectName, this.teamName, b.id))).then(
                            (boards) => this.findAssociatedBoard(boards)
                        ).then(() => void 0);
                    }
                );
            });
        });
    }

    private findAssociatedBoard(boards: Board[]): void {
        this.refreshTimings.measure("getAllBoards");
        const matchingBoards = boards.filter(b => {
            for (let key in b.allowedMappings) {
                return this.workItemType in b.allowedMappings[key];
            }
        });
        this.board = matchingBoards[0];
        if (!this.board) {
            this.completedRefresh();
            return;
        }
        this.updateFields();
        this.completedRefresh();
    }
    private updateFields(): void {
        this.boardColumn = this.workItem.fields[this.board.fields.columnField.referenceName];
        this.boardRow = this.workItem.fields[this.board.fields.rowField.referenceName];
        this.boardDoing = this.workItem.fields[this.board.fields.doneField.referenceName];
    }
    public save(field: "columnField" | "rowField", val: string): IPromise<void>;
    public save(field: "doneField", val: boolean): IPromise<void>;
    public save(field: "columnField" | "rowField" | "doneField", val: string | boolean): IPromise<void> {
        if (!this.board) {
            console.warn(`Save called on ${field} with ${val} when board not set`);
            return Q(null).then(() => void 0);
        }
        this.fieldTimings.measure("timeToClick", false);
        trackEvent("UpdateBoardField", { field, location: this.location }, this.fieldTimings.measurements);
        const patchDocument: JsonPatchDocument & JsonPatchOperation[] = [];
        if (field === "rowField" && !val) {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Remove,
                path: `/fields/${this.board.fields[field].referenceName}`
            });
        } else {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Add,
                path: `/fields/${this.board.fields[field].referenceName}`,
                value: val
            });
        }
        return getWITClient().updateWorkItem(patchDocument, this.id).then<void>(
            (workItem) => {
                this.workItem = workItem;
                this.updateFields();
                return void 0;
            }
        );
    }
}