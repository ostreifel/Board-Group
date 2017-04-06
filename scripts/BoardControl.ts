import { Control, BaseControl } from "VSS/Controls";
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import { BoardColumnType } from "TFS/Work/Contracts";
import { IWorkItemChangedArgs, IWorkItemLoadedArgs } from "TFS/WorkItemTracking/ExtensionContracts";
import { WorkItemFormService } from "TFS/WorkItemTracking/Services";
import { BoardModel } from "./BoardModel";

export class BoardControl extends Control<{}> {
    // data
    private wiId: number;
    private workItemType: string;
    private boardModel: BoardModel;

    // ui
    private columnInput: Combo | null;
    private laneInput: Combo | null;
    private doneInput: Combo | null;

    public refresh() {
        const id = "System.Id";
        const wit = "System.WorkItemType";
        WorkItemFormService.getService().then(service => {
            service.getFieldValues([id, wit]).then(fields => {
                this.wiId = fields[id] as number;
                this.workItemType = fields[wit] as string;
                const refreshUI = () => {
                    if (this.boardModel.getColumn()) {
                        this.updateForBoard();
                    } else {
                        this.updateNoBoard();
                    }
                };
                if (!this.boardModel) {
                    BoardModel.create(this.wiId, "form").then(boardModel => {
                        this.boardModel = boardModel;
                        refreshUI();
                    });
                } else {
                    this.boardModel.refresh().then(refreshUI);
                }
            });
        });
    }

    private updateNoBoard() {
        this._element.html("<div>No associated board for current team</div>");
    }

    private updateForBoard() {
        const boardControl = this;
        const columnOptions: IComboOptions = {
            value: this.boardModel.getColumn(),
            source: this.boardModel.getBoard().columns.map((c) => c.name),
            change: function () {
                const columnValue = boardControl.getColumnInputValue();
                if (columnValue) {
                    boardControl.boardModel.save("columnField", columnValue).then(
                        () => {
                            boardControl.updateForBoard();
                            boardControl.refreshWI();
                        });
                }
            },
            dropOptions: {
                maxRowCount: 5
            }
        };

        const projectName = this.boardModel.teamContext.project;
        const teamName = this.boardModel.teamContext.team;
        const uri = VSS.getWebContext().host.uri;
        const boardName = this.boardModel.getBoard().name;
        const boardUrl = `${uri}${projectName}/${teamName}/_backlogs/board/${boardName}`;

        this._element.html("");
        const boardLink = $("<a/>").text(this.boardModel.getBoard().name)
            .attr({
                href: boardUrl,
                target: "_parent"
            });

        this._element.append(boardLink).append($("<br><br>"));
        if (this.boardModel.getColumn()) {
            this._element.append($("<label/>").addClass("workitemcontrol-label").text("Board Column"));
            this.columnInput = <Combo>BaseControl.createIn(Combo, this._element, columnOptions);
        } else {
            this.columnInput = null;
        }
        this._element.append(`<div class="lane-input" />`);
        this._element.append(`<div class="done-input" />`);
        this._element.append("<div>Board changes are saved immediately.</div>");
        this.updateLaneInput();
        this.updateDoneInput();
    }

    private refreshWI() {
        WorkItemFormService.getService().then(service => {
            if (service["refresh"] instanceof Function) {
                service["refresh"]();
            }
        });
    }

    private updateLaneInput() {
        const laneElem = $(".lane-input", this._element);
        laneElem.html("");
        const columnValue = this.getColumnInputValue();
        const column = this.boardModel.getBoard().columns.filter((c) => c.name === columnValue)[0];
        if (this.boardModel.getBoard().rows.length > 1
            && column.columnType !== BoardColumnType.Incoming
            && column.columnType !== BoardColumnType.Outgoing) {
            const boardControl = this;
            const laneOptions: IComboOptions = {
                value: this.boardModel.getRow() || "(Default Lane)",
                source: this.boardModel.getBoard().rows.map((r) => r.name || "(Default Lane)"),
                change: function () {
                    VSS.resize();
                    const laneValue = boardControl.getLaneInputValue();
                    if (laneValue) {
                        boardControl.boardModel.save("rowField", laneValue).then(
                            () => {
                                boardControl.updateForBoard();
                                boardControl.refreshWI();
                            });
                    }
                },
                dropOptions: {
                    maxRowCount: 5
                }
            };
            laneElem.append($("<label/>").addClass("workitemcontrol-label").text("Board Lane"));
            this.laneInput = <Combo>BaseControl.createIn(Combo, laneElem, laneOptions);
        } else {
            this.laneInput = null;
        }
    }

    private updateDoneInput() {
        const boardControl = this;
        const doneOptions: IComboOptions = {
            value: this.boardModel.getDoing() ? "True" : "False",
            source: ["True", "False"],
            change: function () {
                const doneValue = boardControl.getDoneInputValue();
                if (typeof doneValue === "boolean") {
                    boardControl.boardModel.save("doneField", doneValue).then(
                        () => {
                            boardControl.updateForBoard();
                            boardControl.refreshWI();
                        });
                }
            }
        };
        const columnValue = this.getColumnInputValue();
        const isSplit = this.boardModel.getBoard().columns.filter((c) => c.name === columnValue)[0].isSplit;

        const doneElem = $(".done-input", this._element);
        doneElem.html("");
        if (isSplit) {
            doneElem.append($("<label/>").addClass("workitemcontrol-label").text("Done"));
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

    private getDoneInputValue(): boolean | null {
        if (!this.doneInput || this.doneInput.getSelectedIndex() < 0) {
            return null;
        }
        return this.doneInput.getInputText() === "True";
    }

    public onLoaded(loadedArgs: IWorkItemLoadedArgs) {
        if (!loadedArgs.isNew) {
            this.wiId = loadedArgs.id;
            this._element.html("");
            this._element.append($("<div/>").text("Looking for associated board..."));
            this.refresh();
        }
    }

    public onRefreshed() {
        this.refresh();
    }

    public onSaved(args: IWorkItemChangedArgs) {
        this.refresh();
    }
}