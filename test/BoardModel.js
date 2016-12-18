define(["require", "exports", "TFS/Work/RestClient", "TFS/WorkItemTracking/RestClient", "VSS/WebApi/Contracts", "q"], function (require, exports, RestClient_1, RestClient_2, Contracts_1, Q) {
    "use strict";
    var BoardModel = (function () {
        function BoardModel(id, workItemType) {
            var _this = this;
            this.id = id;
            this.workItemType = workItemType;
            this.getBoard = function () { return _this.board; };
            this.getColumn = function () { return _this.boardColumn; };
            this.getRow = function () { return _this.boardRow; };
            this.getDoing = function () { return _this.boardDoing; };
        }
        BoardModel.create = function (id, workItemType) {
            var boardModel = new BoardModel(id, workItemType);
            return boardModel.refresh().then(function () { return boardModel; });
        };
        BoardModel.prototype.refresh = function () {
            var _this = this;
            var teamContext = {
                project: VSS.getWebContext().project.name,
                projectId: VSS.getWebContext().project.id,
                team: VSS.getWebContext().team.name,
                teamId: VSS.getWebContext().team.id
            };
            return RestClient_1.getClient().getBoards(teamContext).then(function (boardReferences) {
                return Q.all(boardReferences.map(function (b) { return RestClient_1.getClient().getBoard(teamContext, b.id); })).then(function (boards) { return _this.findAssociatedBoard(boards); }).then(function () { return void 0; });
            });
        };
        BoardModel.prototype.findAssociatedBoard = function (boards) {
            var _this = this;
            var matchingBoards = boards.filter(function (b) {
                for (var key in b.allowedMappings) {
                    return _this.workItemType in b.allowedMappings[key];
                }
            });
            this.board = matchingBoards[0];
            this.boardColumn = this.boardDoing = this.boardRow = undefined;
            if (!this.board) {
                return Q(null).then(function () { return void 0; });
            }
            var fields = [
                this.board.fields.columnField.referenceName,
                this.board.fields.rowField.referenceName,
                this.board.fields.doneField.referenceName,
            ];
            return RestClient_2.getClient().getWorkItem(this.id, fields).then(function (workItem) { _this.updateFields(workItem.fields); return void 0; });
        };
        BoardModel.prototype.updateFields = function (fields) {
            this.boardColumn = fields[this.board.fields.columnField.referenceName];
            this.boardRow = fields[this.board.fields.rowField.referenceName];
            this.boardDoing = fields[this.board.fields.doneField.referenceName];
        };
        BoardModel.prototype.save = function (field, val) {
            var _this = this;
            if (!this.board) {
                console.warn("Save called on " + field + " with " + val + " when board not set");
                return Q(null).then(function () { return void 0; });
            }
            var patchDocument = [];
            if (field === "rowField" && !val) {
                patchDocument.push({
                    op: Contracts_1.Operation.Remove,
                    path: "/fields/" + this.board.fields[field].referenceName
                });
            }
            else {
                patchDocument.push({
                    op: Contracts_1.Operation.Add,
                    path: "/fields/" + this.board.fields[field].referenceName,
                    value: val
                });
            }
            return RestClient_2.getClient().updateWorkItem(patchDocument, this.id).then(function (workItem) {
                _this.updateFields(workItem.fields);
                return void 0;
            });
        };
        return BoardModel;
    }());
    exports.BoardModel = BoardModel;
});
