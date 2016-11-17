import {Control, BaseControl} from "VSS/Controls";
import {Combo, IComboOptions} from "VSS/Controls/Combos";
import {WorkItemFormService, IWorkItemFormService} from "TFS/WorkItemTracking/Services";
import {IBoardControlOptions} from "./BoardControl";
import Q = require("q");
import {getClient as getWorkClient} from "TFS/Work/RestClient";
import {BoardReference, Board} from "TFS/Work/Contracts";
import {getClient as getWITClient} from "TFS/WorkItemTracking/RestClient";
import {TeamContext} from "TFS/Core/Contracts";

export interface IBoardControlOptions {
    columnValue: string;
    allowedColumnValues: string[];
    setColumn: (columValue: string)=>IPromise<boolean>;
    laneValue:  string;
    allowedLaneValues:  string[];
    setLane: (laneValue: string)=>IPromise<boolean>;
    boardName: string;
    boardUrl: string;
}

export class BoardControl extends Control<{}> {
    //Data
    private wiId: number;
    private board: Board;

    //UI
    private column: Combo;
    private done: Combo;
    private lane: Combo;
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
            project : VSS.getWebContext().project.name,
            projectId : VSS.getWebContext().project.id,
            team : VSS.getWebContext().team.name,
            teamId : VSS.getWebContext().team.id
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
        const fieldMapping: {[refName: string]: Board} = {};
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
        this._element.html('<div>No associated board for current team</div>');
    }

    private updateForBoard(fields: {[refName: string]: any}, board: Board) {
        this.board = board;
        const columnValue: string = fields[board.fields.columnField.referenceName];
        const rowValue: string = fields[board.fields.rowField.referenceName];
        const doneValue: boolean = fields[board.fields.doneField.referenceName];
        const workItemType: string = fields["System.WorkItemType"];

        const columnOptions: IComboOptions = {
            value: columnValue,
            source: board.columns.map((c) => c.name),
            change: function() {
                const box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    // options.setColumn(box.getInputText());
                }
            }
        };
        const laneOptions: IComboOptions = {
            value: rowValue,
            source: board.rows.map((r) => r.name),
            change: function() {
                const box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    // options.setLane(box.getInputText());
                }
            }
        };
        const doneOptions: IComboOptions = {
            value: doneValue ? 'Yes' : 'No',
            source: ['Yes', 'No'],
            change: function() {
                const box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    // options.setLane(box.getInputText());
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
                target:"_parent"
            });

        this._element.append(boardLink).append($('<br><br>'));
        const boardFields = $('<div/>');
        if (columnValue) {
            boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Column'));
            this.column = <Combo>BaseControl.createIn(Combo, boardFields, columnOptions);
        }
        let isSplit = false;
        for (let column of board.columns.filter((c) => c.name === columnValue)) {
            isSplit = column.isSplit;
        }
        if (isSplit) {
            boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Done'));
            this.done = <Combo>BaseControl.createIn(Combo, boardFields, doneOptions);
        }
        if (rowValue && board.rows.length > 1) {
            boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Lane'));
            this.lane = <Combo>BaseControl.createIn(Combo, boardFields, laneOptions);
        }
        this._element.append(boardFields);
        VSS.resize();
    }
}