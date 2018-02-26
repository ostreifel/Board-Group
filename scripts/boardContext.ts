import { BoardModel } from './boardModel';
import { menuItemsFromBoard } from "./boardMenuItems";

interface IBoardContext {
    id: number;
    workItemType: string;
    updateMenuItems?: (items: IContributedMenuItem[]) => IPromise<void>;
}
const menuAction: Partial<IContributedMenuSource> = {
    getMenuItems: (context: IBoardContext) => {
        if (!context.id) {
            return [];
        }

        // No need to check if on wi board when opening contextmenu from wi on the board.
        const team = VSS.getWebContext().team.name;
        return BoardModel.create(context.id, "card", team).then(boardModel =>
            menuItemsFromBoard(team, boardModel)
        );
    }
};

VSS.register(VSS.getContribution().id, menuAction);
