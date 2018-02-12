import { Control, BaseControl } from "VSS/Controls";
import { Combo, IComboOptions } from "VSS/Controls/Combos";
import { BoardColumnType } from "TFS/Work/Contracts";
import { IWorkItemChangedArgs, IWorkItemLoadedArgs } from "TFS/WorkItemTracking/ExtensionContracts";
import { WorkItemFormService } from "TFS/WorkItemTracking/Services";
import { BoardModel } from "./boardModel";
import { trackEvent } from "./events";
import { Timings } from "./timings";
import { readTeamPreference, storeTeamPreference, IPreferredTeamContext } from "./locateTeam/preferredTeam";
import * as Q from "q";

let updateColunIndexCounter = 0;
const startHeight = () => $(".board-control").height();
const id = "System.Id";
const wit = "System.WorkItemType";
const areaPath = "System.AreaPath";
const projectId = "System.TeamProject";
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

    private updatePreferredTeam(team: string) {
        WorkItemFormService.getService().then(service => {
            service.getFieldValues([id, wit, areaPath, projectId]).then(fields => {
                const context: IPreferredTeamContext = {
                    areaPath: fields[areaPath] as string,
                    projectId: fields[projectId] as string,
                    workItemType: fields[wit] as string
                };
                storeTeamPreference(context, team).then(team => {
                    trackEvent("preferredTeamUpdated", { teamCount: String(this.boardModel.getTeams().length) });
                });
            });
        });
        this.team = team;
        this.refresh();
    }

    public refresh() {
        WorkItemFormService.getService().then(service => {
            service.getFieldValues([id, wit, areaPath, projectId]).then(fields => {
                this.wiId = fields[id] as number;
                const refreshUI = () => {
                    if (this.boardModel.getColumn(this.team)) {
                        this.updateForBoard();
                    } else {
                        this.updateNoBoard();
                    }
                };
                const context: IPreferredTeamContext = {
                    areaPath: fields[areaPath] as string,
                    projectId: fields[projectId] as string,
                    workItemType: fields[wit] as string
                };
                Q.all([BoardModel.create(this.wiId, "form"), readTeamPreference(context)]).then(([boardModel, team]) => {
                    this.boardModel = boardModel;
                    this.team = boardModel.getTeams().some(t => t === team) ? team : boardModel.estimatedTeam();
                    refreshUI();
                });
            });
        });
    }

    private updateNoBoard() {
        this._element.html(`<div class="no-board-message">No board found for the current area path</div>`);
    }

    private readonly onModelSaveSuccess = () => {
        this.refreshWI().then(refreshed => refreshed || this.updateForBoard());
    }
    private readonly onModelSaveFailure = (error: TfsError) => {
        this.updateForBoard();
        const message: string = (error && error.message) ||
            (error && error["value"] && error["value"]["message"]) ||
            error + "";
        $(".board-error", this._element).text(message);
        trackEvent("saveFailure", {message, type: "boardField"});
        VSS.resize();
    }

    private updateForBoard() {
        const boardControl = this;
        const columnOptions: IComboOptions = {
            value: this.boardModel.getColumn(this.team),
            source: this.boardModel.getValidColumns(this.team).map((c) => c.name),
            change: function () {
                const columnValue = boardControl.getColumnInputValue();
                if (columnValue) {
                    boardControl.boardModel.save(boardControl.team, "columnField", columnValue)
                    .then(
                        boardControl.onModelSaveSuccess,
                        boardControl.onModelSaveFailure);
                }
            },

            dropOptions: {
                maxRowCount: 5,
                setTitleOnlyOnOverflow: true
            },
            blur: function (this: Combo) {
                if (!this.isDropVisible()) {
                    VSS.resize();
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
        const boardLink = $("<a/>").addClass("board-link").text(`${this.team}\\${boardName}`)
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
        const dropdown = $(`<ul hidden class=dropdown>${this.boardModel.getTeams().sort().map(t =>
            `<li class=${t === this.team ? 'selected' : 'unselected'}>${t}</li>`
        ).join('')}</ul>`);
        $('li', dropdown).on('click', e => {
            this.updatePreferredTeam(e.target.textContent);
        });
        const button = $(`
            <button class="board-selector">
                <img src="img/chevronIcon.png"/>
            </button>`).click((e) => {
                dropdown.toggle();
                VSS.resize();
                trackEvent("teamSwitcherClick", { expand: String(dropdown.is(":visible")) });
            });
        if (this.boardModel.getTeams().length > 1) {
            this._element.append(button);
            this._element.append(dropdown);
        }
        if (this.boardModel.getColumn(this.team)) {
            this._element.append($("<label/>").addClass("workitemcontrol-label").text("Column"));
            this.columnInput = <Combo>BaseControl.createIn(Combo, this._element, columnOptions);
            this.columnInput._bind("dropDownToggled", (event, args: { isDropVisible: boolean }) => {
                if (args.isDropVisible) {
                    const itemsShown = Math.min(5, this.boardModel.getBoard(this.team).columns.length);
                    const above = this.columnInput._element.position().top + this.columnInput._element.height();
                    const height = Math.max(startHeight(), above + 23 * itemsShown + 5);
                    VSS.resize(window.innerWidth, height);
                } else {
                    VSS.resize();
                }
            });
        } else {
            this.columnInput = null;
        }
        this._element.append(`<div class="lane-input" />`);
        this._element.append(`<div class="done-input" />`);
        this._element.append(`<div class="col-index-input" />`);
        this._element.append(`<div class="disclaimer">Board changes are saved immediately.</div>`);
        this._element.append(`<div class="board-error"></div>`);
        this.updateLaneInput();
        this.updateDoneInput();
        this.updateColumnIndexButton();
        VSS.resize();
    }

    private refreshWI() {
        return WorkItemFormService.getService().then(service => {
            if (service["refresh"] instanceof Function) {
                service["refresh"]();
                return true;
            }
            return false;
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
                        boardControl.boardModel.save(boardControl.team, "rowField", laneValue)
                        .then(
                            boardControl.onModelSaveSuccess,
                            boardControl.onModelSaveFailure);
                    }
                },
                dropOptions: {
                    maxRowCount: 5,
                    setTitleOnlyOnOverflow: true
                },
                blur: function (this: Combo) {
                    if (!this.isDropVisible()) {
                        VSS.resize();
                }
                },
                focus: function (this: Combo) {
                    if (!this.isDropVisible()) {
                        this.toggleDropDown();
                    }
                }
            };
            laneElem.append($("<label/>").addClass("workitemcontrol-label").text("Swimlane"));
            this.laneInput = <Combo>BaseControl.createIn(Combo, laneElem, laneOptions);
            this.laneInput._bind("dropDownToggled focus", (event, args: { isDropVisible: boolean }) => {
                if (this.laneInput.isDropVisible()) {
                    const itemsShown = Math.min(5, this.boardModel.getBoard(this.team).rows.length);
                    const above = this.laneInput._element.position().top + this.laneInput._element.height();
                    const height = Math.max(startHeight(), above + 23 * itemsShown + 5);
                    VSS.resize(window.innerWidth, height);
                } else {
                    VSS.resize();
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
                    boardControl.boardModel.save(boardControl.team, "doneField", doneValue)
                    .then(
                        boardControl.onModelSaveSuccess,
                        boardControl.onModelSaveFailure);
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

    private updateColumnIndexButton() {
        const container = $(".col-index-input", this._element);
        container.empty();
        const start = ++updateColunIndexCounter;
        container.append($("<label/>").addClass("workitemcontrol-label").text("Column Position"));
        const button = $("<button/>").text("Loading position...").attr("disabled", "");
        container.append(button);
        const updateForIndex = (index: number) => {
            if (start !== updateColunIndexCounter) {
                return;
            }
            const posText = index >= 0 ? index + 1 + "" : "Position not found";
            button.text(posText);
            if (index <= 0) {
                button.attr("disabled", "");
                return;
            }
            button.unbind("click");
            button.click(() =>
                this.boardModel.getColumnIndex(this.team, "move to top").then(() => this.updateColumnIndexButton())
            );
            button.removeAttr("disabled");
            button.attr("title", "Move to top");
            VSS.resize();
        }
        const updateFailure = (error) => {
            const message: string = (error && error.message) ||
                (error && error["value"] && error["value"]["message"]) ||
                error + "";
            $(".board-error", this._element).text(message);
            button.text("Could not load position");
            trackEvent("saveFailure", {message, type: "columnIndex"});
            VSS.resize();
        }
        this.boardModel.getColumnIndex(this.team).then(updateForIndex, updateFailure);
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
