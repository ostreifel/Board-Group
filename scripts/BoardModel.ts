import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { Board } from "TFS/Work/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { TeamContext } from "TFS/Core/Contracts";
import { JsonPatchDocument, JsonPatchOperation, Operation } from "VSS/WebApi/Contracts";
import Q = require("q");

function trackEvent(name: string, properties?: {
    [name: string]: string;
}) {
    if (window["appInsights"]) {
        window["appInsights"].trackEvent(name, properties);
        window["appInsights"].flush();
    }
}
export class BoardModel {
    public static create(id: number, workItemType: string, location: string): IPromise<BoardModel> {
        const boardModel = new BoardModel(id, workItemType, location);
        return boardModel.refresh().then(() => boardModel);
    }
    private board: Board;
    public getBoard = () => this.board;
    private boardColumn: string | undefined;
    public getColumn = () => this.boardColumn;
    private boardRow: string | undefined;
    public getRow = () => this.boardRow;
    private boardDoing: boolean;
    public getDoing = () => Boolean(this.boardDoing);
    private constructor(readonly id: number, readonly workItemType: string, readonly location) { }

    public refresh(): IPromise<void> {
        const teamContext: TeamContext = {
            project: VSS.getWebContext().project.name,
            projectId: VSS.getWebContext().project.id,
            team: VSS.getWebContext().team.name,
            teamId: VSS.getWebContext().team.id
        };
        return getWorkClient().getBoards(teamContext).then(
            (boardReferences) => {
                return Q.all(boardReferences.map(b => getWorkClient().getBoard(teamContext, b.id))).then(
                    (boards) => this.findAssociatedBoard(boards)
                ).then(() => void 0);
            }
        );
    }

    private findAssociatedBoard(boards: Board[]): IPromise<void> {
        const matchingBoards = boards.filter(b => {
            for (let key in b.allowedMappings) {
                return this.workItemType in b.allowedMappings[key];
            }
        });
        this.board = matchingBoards[0];
        this.boardColumn = this.boardDoing = this.boardRow = undefined;

        if (!this.board) {
            return Q(null).then(() => void 0);
        }

        const fields: string[] = [
            this.board.fields.columnField.referenceName,
            this.board.fields.rowField.referenceName,
            this.board.fields.doneField.referenceName,
        ];
        return getWITClient().getWorkItem(this.id, fields).then(
            (workItem) => { this.updateFields(workItem.fields); return void 0; }
        );
    }
    private updateFields(fields: { [refName: string]: any }): void {
        this.boardColumn = fields[this.board.fields.columnField.referenceName];
        this.boardRow = fields[this.board.fields.rowField.referenceName];
        this.boardDoing = fields[this.board.fields.doneField.referenceName];
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
        return getWITClient().updateWorkItem(patchDocument, this.id).then(
            (workItem) => {
                this.updateFields(workItem.fields);
                return void 0;
            }
        );
    }
}