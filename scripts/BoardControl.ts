import { Control, BaseControl } from "VSS/Controls";
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import { WorkItemFormService, IWorkItemFormService } from "TFS/WorkItemTracking/Services";
import { IBoardControlOptions } from "./BoardControl";
import Q = require("q");
import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { BoardReference, Board, BoardColumnType } from "TFS/Work/Contracts";
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
    public initialize() {
        this._element.append($('<div/>').text('Looking for associated board...'));
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
        this.doneValue = fields[board.fields.doneField.referenceName] || false;
        this.workItemType = fields["System.WorkItemType"];

        const boardControl = this;
        const columnOptions: IComboOptions = {
            value: this.columnValue,
            source: board.columns.map((c) => c.name),
            change: function () {
                const box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    boardControl.updateState(box.getInputText());
                    boardControl.updateButtonInputs();
                }
            }
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
        this._element.append('<div class="lane-input" />');
        this._element.append('<div class="done-input" />');
        this._element.append('<div class="button-inputs" />');
        this.updateLaneInput();
        this.updateDoneInput();
        this.updateButtonInputs();
        VSS.resize();
    }

    private updateLaneInput() {
        const laneElem = $('.lane-input', this._element);
        laneElem.html('');
        const columnValue = this.getColumnInputValue();
        const column = this.board.columns.filter((c) => c.name === columnValue)[0];
        if (this.board.rows.length > 1 
                && column.columnType !== BoardColumnType.Incoming
                && column.columnType !== BoardColumnType.Outgoing) {
            const boardControl = this;
            const laneOptions: IComboOptions = {
                value: this.rowValue || '(Default Lane)',
                source: this.board.rows.map((r) => r.name || '(Default Lane)'),
                change: function () {
                const box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    boardControl.updateButtonInputs();
                }
            }
            };
            laneElem.append($('<label/>').addClass('workitemcontrol-label').text('Board Lane'));
            this.laneInput = <Combo>BaseControl.createIn(Combo, laneElem, laneOptions);
        } else {
            this.laneInput = null;
        }
    }

    private updateDoneInput() {
        const boardControl = this;
        const doneOptions: IComboOptions = {
            value: this.doneValue ? 'True' : 'False',
            source: ['True', 'False'],
            change: function () {
                const box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    boardControl.updateButtonInputs();
                }
            }
        };
        const columnValue = this.getColumnInputValue();
        const isSplit = this.board.columns.filter((c) => c.name === columnValue)[0].isSplit;

        const doneElem = $('.done-input', this._element);
        doneElem.html('');
        if (isSplit) {
            doneElem.append($('<label/>').addClass('workitemcontrol-label').text('Done'));
            this.doneInput = <Combo>BaseControl.createIn(Combo, doneElem, doneOptions);
        } else {
            this.doneInput = null;
        }
    }

    private updateButtonInputs() {
        const buttonElem = $('.button-inputs', this._element);
        buttonElem.html('');
        if (!this.isDirty()) {
            return;
        }

        WorkItemFormService.getService().then((service) => {
            service.isDirty().then((isDirty) => {
                if (!isDirty) {
                    buttonElem.html('');
                    const reset = $("<button>Reset</button>").click(() => this.onReset());
                    const save = $("<button>Save</button>").click(() => this.onSaved());
                    buttonElem.append(reset, save);
                    VSS.resize();
                }
            })
        });
        
    }

    private updateState(columnVal: string): void {
        const column = this.board.columns.filter((c) => c.name ===columnVal)[0];
        if (column.stateMappings && column.stateMappings[this.workItemType]) {
            WorkItemFormService.getService().then((service) => {
                service.setFieldValue("System.State", column.stateMappings[this.workItemType]);
            });
        }
        this.updateLaneInput();
        this.updateDoneInput();
        this.updateButtonInputs();
    }

    private getLaneInputValue(): string | null {
        if (!this.laneInput || this.laneInput.getSelectedIndex() < 0) {
            return null;
        }
        const inputText = this.laneInput.getInputText();
        return inputText === "(Default Lane)" ? null : inputText;
    }

    private getColumnInputValue(): string | null {
        if (!this.columnInput || this.columnInput.getSelectedIndex() < 0) {
            return null;
        }
        return this.columnInput.getInputText();
    }

    private getDoneInputValue(): boolean {
        if (!this.doneInput || this.doneInput.getSelectedIndex() < 0) {
            return false;
        }
        return this.doneInput.getInputText() === "True";
    }

    public onReset() {
        if (!this.board) {
            return;
        }
        this.columnInput && this.columnInput.setInputText(this.columnValue);
        this.laneInput && this.laneInput.setInputText(this.rowValue);
        this.doneInput && this.doneInput.setInputText(this.doneValue ? "True" : "False");
        this.updateButtonInputs();
    }

    public onRefreshed() {
        this.findAllBoards();
    }

    public onFieldChanged(fieldChangedArgs: IWorkItemFieldChangedArgs) {
        if (!this.board) {
            return;
        }
        const state = fieldChangedArgs.changedFields["System.State"];
        if (!state || !this.board) {
            this.updateButtonInputs();
        }
        const column = this.board.columns.filter((c) => c.stateMappings && c.stateMappings[this.workItemType] === state)[0];
        if (column && this.columnInput && column.name !== this.getColumnInputValue()) {
            this.columnInput.setInputText(column.name);
            this.updateLaneInput();
            this.updateDoneInput();
        }
        this.updateButtonInputs();
    }

    public isDirty(): boolean {
        return (this.rowValue !== this.getLaneInputValue()
            || this.columnValue !== this.getColumnInputValue()
            || (this.doneValue) !== this.getDoneInputValue()
        );
    }

    public onSaved() {
        if (!this.board) {
            return;
        }
        const patchDocument: JsonPatchDocument & JsonPatchOperation[] = [];
        if (this.getColumnInputValue() !== null) {
            patchDocument.push(<JsonPatchOperation>{
                op: Operation.Replace,
                path: `/fields/${this.board.fields.columnField.referenceName}`,
                value: this.getColumnInputValue()
            });
        }
        if (this.laneInput) {
            const laneValue = this.getLaneInputValue();
            if (laneValue) {
                patchDocument.push(<JsonPatchOperation>{
                    op: Operation.Add,
                    path: `/fields/${this.board.fields.rowField.referenceName}`,
                    value: this.getLaneInputValue()
                });
            } else {
                patchDocument.push(<JsonPatchOperation>{
                    op: Operation.Remove,
                    path: `/fields/${this.board.fields.rowField.referenceName}`,
                });
            }
        }
        if (this.doneInput && this.getDoneInputValue() !== null) {
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