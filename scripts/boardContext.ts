import { BoardModel } from './BoardModel';
import { BoardColumnType } from "TFS/Work/Contracts";

function menuItemsFromBoard(boardModel: BoardModel): IContributedMenuItem[] {
    const columns = boardModel.getBoard().columns;
    const rows = boardModel.getBoard().rows;
    const splitItems = (columnName: string) => [{
        text: "Doing",
        action: () => {
            boardModel.save("columnField", columnName).then(() =>
            boardModel.save("doneField", false));
        }
    }, {
        text: "Done",
        action: () => {
            boardModel.save("columnField", columnName).then(() =>
            boardModel.save("doneField", true));
        }
    }];
    const menuItems: IContributedMenuItem[] = [];
    menuItems.push({
        text: "Column",
        groupId: "boardGroup",
        childItems: columns.map(c => {
            return {
                text: c.name,
                title: c.description,
                childItems: c.isSplit ? splitItems(c.name): undefined,
                action: () => boardModel.save("columnField", c.name)
            } as IContributedMenuItem;
        }
        )
    });
    const column = boardModel.getBoard().columns.filter(c => c.name === boardModel.getColumn())[0];
    if (rows.length > 1 && column.columnType === BoardColumnType.InProgress) {
        menuItems.push({
            text: "Row",
            groupId: "boardGroup",
            childItems: rows.map(r => {
                return {
                    text: r.name || "(Default Lane)",
                    action: () => boardModel.save("rowField", r.name)
                } as IContributedMenuItem;
            }),
        });
    }
    return menuItems;
}
interface IBoardContext {
    id: number;
    workItemType;
}
const menuAction: Partial<IContributedMenuSource> = {
    getMenuItems: (context: IBoardContext) =>
        BoardModel.create(context.id, "card").then(boardModel =>
            menuItemsFromBoard(boardModel))
};

VSS.register(VSS.getContribution().id, menuAction);
