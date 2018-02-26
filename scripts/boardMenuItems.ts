import { BoardModel } from './boardModel';
import { BoardColumnType } from "TFS/Work/Contracts";

export function menuItemsFromBoard(teamName: string,
    boardModel: BoardModel,
    saveAction?: {
    (team: string, field: "columnField" | "rowField", val: string): IPromise<void>;
    (team: string, field: "doneField", val: boolean): IPromise<void>;
}
): IContributedMenuItem[] {
    const columns = boardModel.getBoard(teamName).columns;
    const rows = boardModel.getBoard(teamName).rows;
    const splitItems = (columnName: string) => [{
        id: `column.${columnName}.doing`,
        text: "Doing",
        action: () => {
            (saveAction || boardModel.save.bind(boardModel))(teamName, "columnField", columnName).then(() =>
                (saveAction || boardModel.save.bind(boardModel))(teamName, "doneField", false));
        }
    }, {
        id: `column.${columnName}.done`,
        text: "Done",
        action: () => {
            (saveAction || boardModel.save.bind(boardModel))(teamName, "columnField", columnName).then(() =>
                (saveAction || boardModel.save.bind(boardModel))(teamName, "doneField", true));
        }
    }];
    const menuItems: IContributedMenuItem[] = [];
    menuItems.push({
        id: "column",
        text: "Column",
        groupId: "boardGroup",
        icon: "img/columnIcon.png",
        childItems: columns.map(c => {
            return {
                id: `column.${c.name}`,
                text: c.name,
                title: c.description,
                childItems: c.isSplit ? splitItems(c.name) : undefined,
                action: () => (saveAction || boardModel.save.bind(boardModel))(teamName, "columnField", c.name)
            } as IContributedMenuItem;
        }
        )
    });
    const column = boardModel.getBoard(teamName).columns.filter(c => c.name === boardModel.getColumn())[0];
    if (rows.length > 1 && column.columnType === BoardColumnType.InProgress) {
        menuItems.push({
            id: "swimlane",
            text: "Swimlane",
            groupId: "boardGroup",
            icon: "img/rowIcon.png",
            childItems: rows.map(r => {
                return {
                    id: `swimlane.${r.name}`,
                    text: r.name || "(Default Lane)",
                    action: () => (saveAction || boardModel.save.bind(boardModel))(teamName, "rowField", r.name)
                } as IContributedMenuItem;
            }),
        });
    }
    return menuItems;
}