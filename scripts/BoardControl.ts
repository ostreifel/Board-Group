import { Control, BaseControl } from "VSS/Controls";
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import { BoardColumnType } from "TFS/Work/Contracts";
import { IWorkItemChangedArgs, IWorkItemLoadedArgs } from "TFS/WorkItemTracking/ExtensionContracts";
import { WorkItemFormService } from "TFS/WorkItemTracking/Services";
import { BoardModel } from "./BoardModel";
import { trackEvent } from "./events";
import { Timings } from "./timings";

export class BoardControl extends Control<{}> {
    // data
    private wiId: number;
    private boardModel: BoardModel;
    private clickTiming: Timings = new Timings();

    // ui
    private columnInput: Combo | null;
    private laneInput: Combo | null;
    private doneInput: Combo | null;

    public refresh() {
        const id = "System.Id";
        WorkItemFormService.getService().then(service => {
            service.getFieldValues([id]).then(fields => {
                this.wiId = fields[id] as number;
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
        this._element.html(`<div class="no-board-message">No associated board for current areapath</div>`);
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
                maxRowCount: 5,
                setTitleOnlyOnOverflow: true
            },
            blur: () => this.columnInput && !this.columnInput.isDropVisible() && VSS.resize(window.innerWidth, 165)
        };

        const projectName = this.boardModel.teamContext.project;
        const teamName = this.boardModel.teamContext.team;
        const uri = VSS.getWebContext().host.uri;
        const boardName = this.boardModel.getBoard().name;
        const boardUrl = `${uri}${projectName}/${teamName}/_backlogs/board/${boardName}`;

        this._element.html("");
        const boardLink = $("<a/>").addClass("board-link").text(this.boardModel.getBoard().name)
            .attr({
                href: boardUrl,
                target: "_blank",
                title: "Navigate to board"
            })
            .append(`<span class="bowtie-icon bowtie-link"></span>`)
            .click(() => {
                this.clickTiming.measure("timeToClick", false);
                trackEvent("boardLinkClick", {}, this.clickTiming.measurements);
            });
        this._element.append(boardLink);
        if (this.boardModel.getColumn()) {
            this._element.append($("<label/>").addClass("workitemcontrol-label").text("Column"));
            this.columnInput = <Combo>BaseControl.createIn(Combo, this._element, columnOptions);
            this.columnInput._bind("dropDownToggled", (event, args: {isDropVisible: boolean}) => {
                if (args.isDropVisible) {
                    const itemsShown = Math.min(5, this.boardModel.getBoard().columns.length);
                    const height = Math.max(165, 16 + 16 + 20 + 23 * itemsShown + 5);
                    VSS.resize(window.innerWidth, height);
                } else {
                    VSS.resize(window.innerWidth, 165);
                }
            });
            this.columnInput["_updateTooltip"] = () => {};
        } else {
            this.columnInput = null;
        }
        this._element.append(`<div class="lane-input" />`);
        this._element.append(`<div class="done-input" />`);
        this._element.append(`<div class="disclaimer">Board changes are saved immediately.</div>`);
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
                    maxRowCount: 5,
                    setTitleOnlyOnOverflow: true
                },
                blur: () => this.laneInput && !this.laneInput.isDropVisible() && VSS.resize(window.innerWidth, 165)
            };
            laneElem.append($("<label/>").addClass("workitemcontrol-label").text("Lane"));
            this.laneInput = <Combo>BaseControl.createIn(Combo, laneElem, laneOptions);
            this.laneInput._bind("dropDownToggled", (event, args: {isDropVisible: boolean}) => {
                if (args.isDropVisible) {
                    const itemsShown = Math.min(5, this.boardModel.getBoard().rows.length);
                    const height = Math.max(165, 16 + 16 + 20 + 16 + 20 + 23 * itemsShown + 5);
                    VSS.resize(window.innerWidth, height);
                } else {
                    VSS.resize(window.innerWidth, 165);
                }
            });
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
            },
            dropOptions: {
                setTitleOnlyOnOverflow: true,
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