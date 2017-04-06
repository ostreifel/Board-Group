import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { Board } from "TFS/Work/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItem } from "TFS/WorkItemTracking/Contracts";
import { TeamContext } from "TFS/Core/Contracts";
import { JsonPatchDocument, JsonPatchOperation, Operation } from "VSS/WebApi/Contracts";
import Q = require("q");
import { getTeamsForAreaPathFromCache } from "./locateTeam/teamNodeCache";
import { trackEvent } from "./events";

const projectField = "System.TeamProject";
const witField = "System.WorkItemType";
const areaPathField = "System.AreaPath";
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
    public teamContext: TeamContext;


    private workItem: WorkItem;
    private workItemType: string;
    private constructor(readonly id: number, readonly location) { }

    public refresh(): IPromise<void> {
        delete this.board;
        this.boardColumn = this.boardRow = this.boardDoing = undefined;
        return getWITClient().getWorkItem(this.id).then(wi => {
            this.workItem = wi;
            this.workItemType = wi.fields[witField];
            return getTeamsForAreaPathFromCache(wi.fields[projectField], wi.fields[areaPathField]).then(teams => {
                if (teams.length === 0) {
                    return;
                }
                const lastTeam = teams[teams.length - 1];
                this.teamContext = {
                    project: wi.fields[projectField],
                    projectId: wi.fields[projectField],
                    team: lastTeam.name,
                    teamId: lastTeam.id
                };
                return getWorkClient().getBoards(this.teamContext).then(
                    (boardReferences) => {
                        return Q.all(boardReferences.map(b => getWorkClient().getBoard(this.teamContext, b.id))).then(
                            (boards) => this.findAssociatedBoard(boards)
                        ).then(() => void 0);
                    }
                );
            });
        });
    }

    private findAssociatedBoard(boards: Board[]): void {
        const matchingBoards = boards.filter(b => {
            for (let key in b.allowedMappings) {
                return this.workItemType in b.allowedMappings[key];
            }
        });
        this.board = matchingBoards[0];
        if (!this.board) {
            return;
        }
        this.updateFields();
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
        trackEvent("UpdateBoardField", { field, location: this.location });
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