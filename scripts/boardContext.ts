import { BoardModel } from './boardModel';
import { BoardColumnType } from "TFS/Work/Contracts";

function menuItemsFromBoard(boardModel: BoardModel): IContributedMenuItem[] {
    // No need to check if on wi board when opening contextmenu from wi on the board.
    const teamName = VSS.getWebContext().team.name;
    const columns = boardModel.getBoard(teamName).columns;
    const rows = boardModel.getBoard(teamName).rows;
    const splitItems = (columnName: string) => [{
        text: "Doing",
        action: () => {
            boardModel.save(teamName, "columnField", columnName).then(() =>
            boardModel.save(teamName, "doneField", false));
        }
    }, {
        text: "Done",
        action: () => {
            boardModel.save(teamName, "columnField", columnName).then(() =>
            boardModel.save(teamName, "doneField", true));
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
                action: () => boardModel.save(teamName, "columnField", c.name)
            } as IContributedMenuItem;
        }
        )
    });
    const column = boardModel.getBoard(teamName).columns.filter(c => c.name === boardModel.getColumn())[0];
    if (rows.length > 1 && column.columnType === BoardColumnType.InProgress) {
        menuItems.push({
            text: "Row",
            groupId: "boardGroup",
            childItems: rows.map(r => {
                return {
                    text: r.name || "(Default Lane)",
                    action: () => boardModel.save(teamName, "rowField", r.name)
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
