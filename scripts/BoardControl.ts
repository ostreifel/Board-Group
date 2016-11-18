import { Control, BaseControl } from "VSS/Controls";
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import { WorkItemFormService, IWorkItemFormService } from "TFS/WorkItemTracking/Services";
import { IBoardControlOptions } from "./BoardControl";
import Q = require("q");
import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { BoardReference, Board } from "TFS/Work/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { TeamContext } from "TFS/Core/Contracts";
import { IWorkItemChangedArgs, IWorkItemFieldChangedArgs } from "TFS/WorkItemTracking/ExtensionContracts";
import {JsonPatchDocument, JsonPatchOperation, Operation} from "VSS/WebApi/Contracts";

export interface IBoardControlOptions {
    columnValue: string;
    allowedColumnValues: string[];
    setColumn: (columValue: string) => IPromise<boolean>;
    laneValue: string;
    allowedLaneValues: string[];
    setLane: (laneValue: string) => IPromise<boolean>;
    boardName: string;
    boardUrl: string;
}

export class BoardControl extends Control<{}> {
    //Data
    private wiId: number;
    private board: Board;
    private columnValue: string;
    private rowValue: string;
    private doneValue: boolean;
    private workItemType: string;

    //UI
    private columnInput: Combo;
    private laneInput: Combo;
    private doneInput: Combo;
    private doneLabel: JQuery;
    public initialize() {
        this._element.append($('<div/>').text('Looking for associated board.'));
        VSS.resize();
        this.findAllBoards();

    }
    private findAllBoards() {
        const optionsDeferred: Q.Deferred<IBoardControlOptions> = Q.defer<IBoardControlOptions>();

        const rejectOnError = (error: TfsError | string) => {
            optionsDeferred.reject(error)
        };

        const teamContext: TeamContext = {
            project: VSS.getWebContext().project.name,
            projectId: VSS.getWebContext().project.id,
            team: VSS.getWebContext().team.name,
            teamId: VSS.getWebContext().team.id
        };
        WorkItemFormService.getService().then((service) => {
            Q.all([service.getId(), getWorkClient().getBoards(teamContext)]).then(
                ([wiId, boardReferences]) => {
                    Q.all(boardReferences.map(b => getWorkClient().getBoard(teamContext, b.id))).then(
                        (boards) => this.findAssociatedBoard(wiId, boards)
                    )
                }
            )
        });
    }

    private findAssociatedBoard(wiId: number, boards: Board[]) {
        this.wiId = wiId;
        const fields: string[] = ["System.WorkItemType"];
        const fieldMapping: { [refName: string]: Board } = {};
        for (let board of boards) {
            for (let field of [board.fields.columnField, board.fields.rowField, board.fields.doneField]) {
                fields.push(field.referenceName);
                fieldMapping[field.referenceName] = board;
            }
        }
        getWITClient().getWorkItem(wiId, fields).then(
            (workItem) => {
                if (Object.keys(workItem.fields).length === 1) {
                    this.updateNoBoard();
                } else {
                    const board = fieldMapping[Object.keys(workItem.fields)[1]];
                    this.updateForBoard(workItem.fields, board)
                }
            }
        )
    }

    private updateNoBoard() {
        this.board = null;
        this._element.html('<div>No associated board for current team</div>');
    }

    private updateForBoard(fields: { [refName: string]: any }, board: Board) {
        this.board = board;
        this.columnValue = fields[board.fields.columnField.referenceName] || null;
        this.rowValue = fields[board.fields.rowField.referenceName] || null;
        this.doneValue = fields[board.fields.doneField.referenceName] || null;
        this.workItemType = fields["System.WorkItemType"];

        const boardControl = this;
        const columnOptions: IComboOptions = {
            value: this.columnValue,
            source: board.columns.map((c) => c.name),
            change: function () {
                const box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    boardControl.updateState(box.getInputText());
                }
            }
        };
        const laneOptions: IComboOptions = {
            value: this.rowValue,
            source: board.rows.map((r) => r.name)
        };

        const accountName = VSS.getWebContext().account.name;
        const projectName = VSS.getWebContext().project.name;
        const teamName = VSS.getWebContext().team.name;
        const uri = VSS.getWebContext().host.uri;
        const boardUrl = `${uri}${projectName}/${teamName}/_backlogs/board/${board.name}`;

        this._element.html('')
        const boardLink = $('<a/>').text(board.name)
            .attr({
                href: boardUrl,
                target: "_parent"
            });

        this._element.append(boardLink).append($('<br><br>'));
        if (this.columnValue) {
            this._element.append($('<label/>').addClass('workitemcontrol-label').text('Board Column'));
            this.columnInput = <Combo>BaseControl.createIn(Combo, this._element, columnOptions);
        } else {
            this.columnInput = null;
        }
        if (this.rowValue && board.rows.length > 1) {
            this._element.append($('<label/>').addClass('workitemcontrol-label').text('Board Lane'));
            this.laneInput = <Combo>BaseControl.createIn(Combo, this._element, laneOptions);
        } else {
            this.laneInput = null;
        }
        this.updateDoneInput();
        VSS.resize();
    }

    private updateDoneInput() {
        const doneOptions: IComboOptions = {
            value: this.doneValue ? 'True' : 'False',
            source: ['True', 'False']
        };
        const columnValue = this.getColumnInputValue();
        let isSplit = false;
        for (let column of this.board.columns.filter((c) => c.name === columnValue)) {
            isSplit = column.isSplit;
        }
        if (isSplit) {
            this.doneLabel = $('<label/>').addClass('workitemcontrol-label').text('Done');
            this._element.append(this.doneLabel);
            this.doneInput = <Combo>BaseControl.createIn(Combo, this._element, doneOptions);
        } else {
            if (this.doneInput) {
                this.doneLabel.remove();
                this.doneInput.getElement().remove();
            }
            this.doneInput = null;
        }
    }

    private updateState(columnVal: string): void {
        const column = this.board.columns.filter((c) => c.name ===columnVal)[0];
        if (column.stateMappings && column.stateMappings[this.workItemType]) {
            WorkItemFormService.getService().then((service) => {
                service.setFieldValue("System.State", column.stateMappings[this.workItemType]);
            });
        }
        this.updateDoneInput();
    }

    private getLaneInputValue(): string | null {
        if (!this.laneInput || this.laneInput.getSelectedIndex() < 0) {
            return null;
        }
        return this.laneInput.getInputText();
    }

    private getColumnInputValue(): string | null {
        if (!this.columnInput || this.columnInput.getSelectedIndex() < 0) {
            return null;
        }
        return this.columnInput.getInputText();
    }

    private getDoneInputValue(): boolean | null {
        if (!this.doneInput || this.doneInput.getSelectedIndex() < 0) {
            return null;
        }
        return this.doneInput.getInputText() === "True";
    }

    public onReset() {
        this.columnInput && this.columnInput.setInputText(this.columnValue);
        this.laneInput && this.laneInput.setInputText(this.rowValue);
        this.doneInput && this.doneInput.setInputText(this.doneValue ? "True" : "False");
    }

    public onRefreshed() {
        this.findAssociatedBoard(this.wiId, [this.board]);
    }

    public onFieldChanged(fieldChangedArgs: IWorkItemFieldChangedArgs) {
        const state = fieldChangedArgs.changedFields["System.State"];
        if (!state) {
            return;
        }
        const column = this.board.columns.filter((c) => c.stateMappings && c.stateMappings[this.workItemType] === state)[0];
        if (column) {
            this.columnInput.setInputText(column.name);
            this.updateDoneInput();
        }
    }

    public isDirty(): boolean {
        return (this.rowValue !== this.getLaneInputValue()
            || this.columnValue !== this.getColumnInputValue()
            || this.doneValue !== this.getDoneInputValue()
        );
    }

    public onSaved(savedEventArgs: IWorkItemChangedArgs) {
        const patchDocument: JsonPatchDocument & JsonPatchOperation[] = [];
        if (null !== this.getColumnInputValue()) {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Add,
                path: `/fields/${this.board.fields.columnField.referenceName}`,
                value: this.getColumnInputValue()
            });
        }
        if (this.laneInput) {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Add,
                path: `/fields/${this.board.fields.rowField.referenceName}`,
                value: this.getLaneInputValue()
            });
        }
        if (this.doneInput) {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Add,
                path: `/fields/${this.board.fields.doneField.referenceName}`,
                value: this.getDoneInputValue()
            });
        }
        if (this.isDirty()) {
            getWITClient().updateWorkItem(patchDocument, this.wiId).then(
                (workItem) => {
                    this.updateForBoard(workItem.fields, this.board);
                }
            );
        }
    }
}