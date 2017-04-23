import { BoardModel } from './boardModel';
import { menuItemsFromBoard } from "./boardMenuItems";

interface IBoardContext {
    id: number;
    workItemType;
}
const menuAction: Partial<IContributedMenuSource> = {
    getMenuItems: (context: IBoardContext) =>
        BoardModel.create(context.id, "card").then(boardModel =>
            // No need to check if on wi board when opening contextmenu from wi on the board.
            menuItemsFromBoard(VSS.getWebContext().team.name, boardModel))
};

VSS.register(VSS.getContribution().id, menuAction);
