import { Control, BaseControl } from "VSS/Controls";
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import { BoardColumnType } from "TFS/Work/Contracts";
import { IWorkItemChangedArgs, IWorkItemLoadedArgs } from "TFS/WorkItemTracking/ExtensionContracts";
import { WorkItemFormService } from "TFS/WorkItemTracking/Services";
import { BoardModel } from "./boardModel";
import { trackEvent } from "./events";
import { Timings } from "./timings";

const startHeight = 175;
export class BoardControl extends Control<{}> {
    // data
    private wiId: number;
    private boardModel: BoardModel;
    private team: string;
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
                    if (this.boardModel.getColumn(this.team)) {
                        this.updateForBoard();
                    } else {
                        this.updateNoBoard();
                    }
                };
                if (!this.boardModel) {
                    BoardModel.create(this.wiId, "form").then(boardModel => {
                        this.boardModel = boardModel;
                        this.team = this.team || boardModel.estimatedTeam();
                        refreshUI();
                    });
                } else {
                    this.boardModel.refresh(this.wiId).then(refreshUI);
                }
            });
        });
    }

    private updateNoBoard() {
        this._element.html(`<div class="no-board-message">No board found for the current area path</div>`);
    }

    private updateForBoard() {
        const boardControl = this;
        const columnOptions: IComboOptions = {
            value: this.boardModel.getColumn(this.team),
            source: this.boardModel.getBoard(this.team).columns.map((c) => c.name),
            change: function () {
                const columnValue = boardControl.getColumnInputValue();
                if (columnValue) {
                    boardControl.boardModel.save(undefined, "columnField", columnValue).then(
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
            blur: function (this: Combo) {
                if (!this.isDropVisible()) {
                    VSS.resize(window.innerWidth, startHeight);
                }
            },
            focus: function (this: Combo) {
                if (!this.isDropVisible()) {
                    this.toggleDropDown();
                }
            }
        };

        const projectName = this.boardModel.projectName;
        const uri = VSS.getWebContext().host.uri;
        const boardName = this.boardModel.getBoard(this.team).name;
        const boardUrl = `${uri}${projectName}/${this.team}/_backlogs/board/${boardName}`;

        this._element.html("");
        const boardLink = $("<a/>").addClass("board-link").text(boardName)
            .attr({
                href: boardUrl,
                target: "_blank",
                title: "Navigate to board"
            })
            // .prepend(`<span class="bowtie-icon bowtie-link"></span>`)
            .click(() => {
                this.clickTiming.measure("timeToClick", false);
                trackEvent("boardLinkClick", {}, this.clickTiming.measurements);
            });
        this._element.append(boardLink);
        const dropdown = $(`<ul hidden class=dropdown>${this.boardModel.getTeams().map(t =>
            `<li class=${t===this.team ? 'selected' : 'unselected'}>${t}</li>`
        ).join('')}</ul>`);
        $('li', dropdown).on('click', e => {
            this.team = e.target.textContent;
            this.refresh();
        })
        const button = $(`
            <button class="board-selector">
                <img src="img/chevronIcon.png"/>
            </button>`).on("click", (e) => {
                dropdown.toggle();
                VSS.resize();
            });
        this._element.append(button);
        this._element.append(dropdown);
        if (this.boardModel.getColumn(this.team)) {
            this._element.append($("<label/>").addClass("workitemcontrol-label").text("Column"));
            this.columnInput = <Combo>BaseControl.createIn(Combo, this._element, columnOptions);
            this.columnInput._bind("dropDownToggled", (event, args: { isDropVisible: boolean }) => {
                if (args.isDropVisible) {
                    const itemsShown = Math.min(5, this.boardModel.getBoard(this.team).columns.length);
                    const above = this.columnInput._element.position().top + this.columnInput._element.height();
                    const height = Math.max(startHeight, above + 23 * itemsShown + 5);
                    VSS.resize(window.innerWidth, height);
                } else {
                    VSS.resize(window.innerWidth, startHeight);
                }
            });
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
        const column = this.boardModel.getBoard(this.team).columns.filter((c) => c.name === columnValue)[0];
        if (this.boardModel.getBoard(this.team).rows.length > 1
            && column.columnType !== BoardColumnType.Incoming
            && column.columnType !== BoardColumnType.Outgoing) {
            const boardControl = this;
            const laneOptions: IComboOptions = {
                value: this.boardModel.getRow(this.team) || "(Default Lane)",
                source: this.boardModel.getBoard(this.team).rows.map((r) => r.name || "(Default Lane)"),
                change: function () {
                    const laneValue = boardControl.getLaneInputValue();
                    if (laneValue) {
                        boardControl.boardModel.save(undefined, "rowField", laneValue).then(
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
                blur: function (this: Combo) {
                    if (!this.isDropVisible()) {
                        VSS.resize(window.innerWidth, startHeight);
                    }
                },
                focus: function (this: Combo) {
                    if (!this.isDropVisible()) {
                        this.toggleDropDown();
                    }
                }
            };
            laneElem.append($("<label/>").addClass("workitemcontrol-label").text("Lane"));
            this.laneInput = <Combo>BaseControl.createIn(Combo, laneElem, laneOptions);
            this.laneInput._bind("dropDownToggled focus", (event, args: { isDropVisible: boolean }) => {
                if (this.laneInput.isDropVisible()) {
                    const itemsShown = Math.min(5, this.boardModel.getBoard(this.team).rows.length);
                    const above = this.laneInput._element.position().top + this.laneInput._element.height();
                    const height = Math.max(startHeight, above + 23 * itemsShown + 5);
                    VSS.resize(window.innerWidth, height);
                } else {
                    VSS.resize(window.innerWidth, startHeight);
                }
            });
        } else {
            this.laneInput = null;
        }
    }

    private updateDoneInput() {
        const boardControl = this;
        const doneOptions: IComboOptions = {
            value: this.boardModel.getDoing(this.team) ? "True" : "False",
            source: ["True", "False"],
            change: function () {
                const doneValue = boardControl.getDoneInputValue();
                if (typeof doneValue === "boolean") {
                    boardControl.boardModel.save(undefined, "doneField", doneValue).then(
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
        const isSplit = this.boardModel.getBoard(this.team).columns.filter((c) => c.name === columnValue)[0].isSplit;

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
        if (loadedArgs.isNew) {
            this._element.html(`<div class="new-wi-message">Save the work item to see board data</div>`);
        } else {
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
