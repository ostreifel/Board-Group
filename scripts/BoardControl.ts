import { Control, BaseControl } from "VSS/Controls";
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import { WorkItemFormService, IWorkItemFormService } from "TFS/WorkItemTracking/Services";
import { IBoardControlOptions } from "./BoardControl";
import Q = require("q");
import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { BoardReference, Board, BoardColumnType } from "TFS/Work/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { TeamContext } from "TFS/Core/Contracts";
import { IWorkItemChangedArgs, IWorkItemFieldChangedArgs, IWorkItemLoadedArgs } from "TFS/WorkItemTracking/ExtensionContracts";
import { JsonPatchDocument, JsonPatchOperation, Operation } from "VSS/WebApi/Contracts";

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
        VSS.resize();
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
        getWorkClient().getBoards(teamContext).then(
            (boardReferences) => {
                Q.all(boardReferences.map(b => getWorkClient().getBoard(teamContext, b.id))).then(
                    (boards) => this.findAssociatedBoard(boards)
                )
            }
        );
    }

    private findAssociatedBoard(boards: Board[]) {
        const fields: string[] = ["System.WorkItemType"];
        const fieldMapping: { [refName: string]: Board } = {};
        for (let board of boards) {
            for (let field of [board.fields.columnField, board.fields.rowField, board.fields.doneField]) {
                fields.push(field.referenceName);
                fieldMapping[field.referenceName] = board;
            }
        }
        getWITClient().getWorkItem(this.wiId, fields).then(
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
                    boardControl.save("columnField", boardControl.getColumnInputValue());
                }
            },
            dropOptions: {
                maxRowCount: 5
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
        this._element.append('<div>Board changes are saved immediately.</div>')
        this.updateLaneInput();
        this.updateDoneInput();
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
                    VSS.resize();
                    const box: Combo = this;
                    if (box.getSelectedIndex() > -1) {
                        boardControl.save("rowField", boardControl.getLaneInputValue());
                    }
                },
                dropOptions: {
                    maxRowCount: 5
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
                    boardControl.save("doneField", boardControl.getDoneInputValue());
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

    public onLoaded(loadedArgs: IWorkItemLoadedArgs) {
        if (!loadedArgs.isNew) {
            this.wiId = loadedArgs.id;
            this._element.html('');
            this._element.append($('<div/>').text('Looking for associated board...'));
            this.findAllBoards();
        }
    }

    public onRefreshed() {
        this.findAllBoards();
    }

    public isDirty(): boolean {
        return (this.rowValue !== this.getLaneInputValue()
            || this.columnValue !== this.getColumnInputValue()
            || (this.doneValue) !== this.getDoneInputValue()
        );
    }

    private save(field: 'columnField' | 'rowField', val: string);
    private save(field: 'doneField', val: boolean);
    private save(field: 'columnField' | 'rowField' | 'doneField', val: string | boolean) {
        if (!this.board) {
            console.warn(`Save called on ${field} with ${val} when board not set`);
            return;
        }
        const patchDocument: JsonPatchDocument & JsonPatchOperation[] = [];
        if (field === 'rowField' && !val) {
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
        getWITClient().updateWorkItem(patchDocument, this.wiId).then(
            (workItem) => {
                this.updateForBoard(workItem.fields, this.board);
            }
        );
    }

    public onSaved(args: IWorkItemChangedArgs) {
        this.findAllBoards();
    }
}