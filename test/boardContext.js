define(["require", "exports", "./BoardModel", "TFS/Work/Contracts"], function (require, exports, BoardModel_1, Contracts_1) {
    "use strict";
    function menuItemsFromBoard(boardModel) {
        var columns = boardModel.getBoard().columns;
        var rows = boardModel.getBoard().rows;
        var splitItems = function (columnName) { return [{
                text: "Doing",
                action: function () {
                    boardModel.save("columnField", columnName).then(function () {
                        return boardModel.save("doneField", false);
                    });
                }
            }, {
                text: "Done",
                action: function () {
                    boardModel.save("columnField", columnName).then(function () {
                        return boardModel.save("doneField", true);
                    });
                }
            }]; };
        var menuItems = [];
        menuItems.push({
            text: "Column",
            groupId: "boardGroup",
            childItems: columns.map(function (c) {
                return {
                    text: c.name,
                    title: c.description,
                    childItems: c.isSplit ? splitItems(c.name) : undefined,
                    action: function () { return boardModel.save("columnField", c.name); }
                };
            })
        });
        var column = boardModel.getBoard().columns.filter(function (c) { return c.name === boardModel.getColumn(); })[0];
        if (rows.length > 1 && column.columnType === Contracts_1.BoardColumnType.InProgress) {
            menuItems.push({
                text: "Row",
                groupId: "boardGroup",
                childItems: rows.map(function (r) {
                    return {
                        text: r.name || "(Default Lane)",
                        action: function () { return boardModel.save("rowField", r.name); }
                    };
                }),
            });
        }
        return menuItems;
    }
    var menuAction = {
        getMenuItems: function (context) {
            return BoardModel_1.BoardModel.create(context.id, context.workItemType).then(function (boardModel) {
                return menuItemsFromBoard(boardModel);
            });
        }
    };
    VSS.register(VSS.getContribution().id, menuAction);
});
