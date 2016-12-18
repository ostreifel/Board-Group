var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", "VSS/Controls", "VSS/Controls/Combos", "q", "TFS/Work/RestClient", "TFS/Work/Contracts", "TFS/WorkItemTracking/RestClient", "VSS/WebApi/Contracts"], function (require, exports, Controls_1, Combos_1, Q, RestClient_1, Contracts_1, RestClient_2, Contracts_2) {
    "use strict";
    var BoardControl = (function (_super) {
        __extends(BoardControl, _super);
        function BoardControl() {
            return _super.apply(this, arguments) || this;
        }
        BoardControl.prototype.initialize = function () {
            VSS.resize();
        };
        BoardControl.prototype.findAllBoards = function () {
            var _this = this;
            var teamContext = {
                project: VSS.getWebContext().project.name,
                projectId: VSS.getWebContext().project.id,
                team: VSS.getWebContext().team.name,
                teamId: VSS.getWebContext().team.id
            };
            RestClient_1.getClient().getBoards(teamContext).then(function (boardReferences) {
                Q.all(boardReferences.map(function (b) { return RestClient_1.getClient().getBoard(teamContext, b.id); })).then(function (boards) { return _this.findAssociatedBoard(boards); });
            });
        };
        BoardControl.prototype.findAssociatedBoard = function (boards) {
            var _this = this;
            var fields = ["System.WorkItemType"];
            var fieldMapping = {};
            for (var _i = 0, boards_1 = boards; _i < boards_1.length; _i++) {
                var board = boards_1[_i];
                for (var _a = 0, _b = [board.fields.columnField, board.fields.rowField, board.fields.doneField]; _a < _b.length; _a++) {
                    var field = _b[_a];
                    fields.push(field.referenceName);
                    fieldMapping[field.referenceName] = board;
                }
            }
            RestClient_2.getClient().getWorkItem(this.wiId, fields).then(function (workItem) {
                if (Object.keys(workItem.fields).length === 1) {
                    _this.updateNoBoard();
                }
                else {
                    var board = fieldMapping[Object.keys(workItem.fields)[1]];
                    _this.updateForBoard(workItem.fields, board);
                }
            });
        };
        BoardControl.prototype.updateNoBoard = function () {
            this.board = null;
            this._element.html("<div>No associated board for current team</div>");
        };
        BoardControl.prototype.updateForBoard = function (fields, board) {
            this.board = board;
            this.columnValue = fields[board.fields.columnField.referenceName] || null;
            this.rowValue = fields[board.fields.rowField.referenceName] || null;
            this.doneValue = fields[board.fields.doneField.referenceName] || false;
            this.workItemType = fields["System.WorkItemType"];
            var boardControl = this;
            var columnOptions = {
                value: this.columnValue,
                source: board.columns.map(function (c) { return c.name; }),
                change: function () {
                    var box = this;
                    if (box.getSelectedIndex() > -1) {
                        boardControl.save("columnField", boardControl.getColumnInputValue());
                    }
                },
                dropOptions: {
                    maxRowCount: 5
                }
            };
            var projectName = VSS.getWebContext().project.name;
            var teamName = VSS.getWebContext().team.name;
            var uri = VSS.getWebContext().host.uri;
            var boardUrl = "" + uri + projectName + "/" + teamName + "/_backlogs/board/" + board.name;
            this._element.html("");
            var boardLink = $("<a/>").text(board.name)
                .attr({
                href: boardUrl,
                target: "_parent"
            });
            this._element.append(boardLink).append($("<br><br>"));
            if (this.columnValue) {
                this._element.append($("<label/>").addClass("workitemcontrol-label").text("Board Column"));
                this.columnInput = Controls_1.BaseControl.createIn(Combos_1.Combo, this._element, columnOptions);
            }
            else {
                this.columnInput = null;
            }
            this._element.append("<div class=\"lane-input\" />");
            this._element.append("<div class=\"done-input\" />");
            this._element.append("<div>Board changes are saved immediately.</div>");
            this.updateLaneInput();
            this.updateDoneInput();
        };
        BoardControl.prototype.updateLaneInput = function () {
            var laneElem = $(".lane-input", this._element);
            laneElem.html("");
            var columnValue = this.getColumnInputValue();
            var column = this.board.columns.filter(function (c) { return c.name === columnValue; })[0];
            if (this.board.rows.length > 1
                && column.columnType !== Contracts_1.BoardColumnType.Incoming
                && column.columnType !== Contracts_1.BoardColumnType.Outgoing) {
                var boardControl_1 = this;
                var laneOptions = {
                    value: this.rowValue || "(Default Lane)",
                    source: this.board.rows.map(function (r) { return r.name || "(Default Lane)"; }),
                    change: function () {
                        VSS.resize();
                        var box = this;
                        if (box.getSelectedIndex() > -1) {
                            boardControl_1.save("rowField", boardControl_1.getLaneInputValue());
                        }
                    },
                    dropOptions: {
                        maxRowCount: 5
                    }
                };
                laneElem.append($("<label/>").addClass("workitemcontrol-label").text("Board Lane"));
                this.laneInput = Controls_1.BaseControl.createIn(Combos_1.Combo, laneElem, laneOptions);
            }
            else {
                this.laneInput = null;
            }
        };
        BoardControl.prototype.updateDoneInput = function () {
            var boardControl = this;
            var doneOptions = {
                value: this.doneValue ? "True" : "False",
                source: ["True", "False"],
                change: function () {
                    var box = this;
                    if (box.getSelectedIndex() > -1) {
                        boardControl.save("doneField", boardControl.getDoneInputValue());
                    }
                }
            };
            var columnValue = this.getColumnInputValue();
            var isSplit = this.board.columns.filter(function (c) { return c.name === columnValue; })[0].isSplit;
            var doneElem = $(".done-input", this._element);
            doneElem.html("");
            if (isSplit) {
                doneElem.append($("<label/>").addClass("workitemcontrol-label").text("Done"));
                this.doneInput = Controls_1.BaseControl.createIn(Combos_1.Combo, doneElem, doneOptions);
            }
            else {
                this.doneInput = null;
            }
        };
        BoardControl.prototype.getLaneInputValue = function () {
            if (!this.laneInput || this.laneInput.getSelectedIndex() < 0) {
                return null;
            }
            var inputText = this.laneInput.getInputText();
            return inputText === "(Default Lane)" ? null : inputText;
        };
        BoardControl.prototype.getColumnInputValue = function () {
            if (!this.columnInput || this.columnInput.getSelectedIndex() < 0) {
                return null;
            }
            return this.columnInput.getInputText();
        };
        BoardControl.prototype.getDoneInputValue = function () {
            if (!this.doneInput || this.doneInput.getSelectedIndex() < 0) {
                return false;
            }
            return this.doneInput.getInputText() === "True";
        };
        BoardControl.prototype.onLoaded = function (loadedArgs) {
            if (!loadedArgs.isNew) {
                this.wiId = loadedArgs.id;
                this._element.html("");
                this._element.append($("<div/>").text("Looking for associated board..."));
                this.findAllBoards();
            }
        };
        BoardControl.prototype.onRefreshed = function () {
            this.findAllBoards();
        };
        BoardControl.prototype.isDirty = function () {
            return (this.rowValue !== this.getLaneInputValue()
                || this.columnValue !== this.getColumnInputValue()
                || (this.doneValue) !== this.getDoneInputValue());
        };
        BoardControl.prototype.save = function (field, val) {
            var _this = this;
            if (!this.board) {
                console.warn("Save called on " + field + " with " + val + " when board not set");
                return;
            }
            var patchDocument = [];
            if (field === "rowField" && !val) {
                patchDocument.push({
                    op: Contracts_2.Operation.Remove,
                    path: "/fields/" + this.board.fields[field].referenceName
                });
            }
            else {
                patchDocument.push({
                    op: Contracts_2.Operation.Add,
                    path: "/fields/" + this.board.fields[field].referenceName,
                    value: val
                });
            }
            RestClient_2.getClient().updateWorkItem(patchDocument, this.wiId).then(function (workItem) {
                _this.updateForBoard(workItem.fields, _this.board);
            });
        };
        BoardControl.prototype.onSaved = function (args) {
            this.findAllBoards();
        };
        return BoardControl;
    }(Controls_1.Control));
    exports.BoardControl = BoardControl;
});
