import { BoardModel } from './boardModel';
import { menuItemsFromBoard } from "./boardMenuItems";

interface IBoardContext {
    id: number;
    workItemType: string;
    updateMenuItems?: (items: IContributedMenuItem[]) => Promise<void>;
}
const menuAction: Partial<IContributedMenuSource> = {
    getMenuItems: async (context: IBoardContext) => {
        if (!context.id) {
            return [];
        }

        // No need to check if on wi board when opening contextmenu from wi on the board.
        const team = VSS.getWebContext().team.name;
        const boardModel = await BoardModel.create(context.id, "card", team);
        menuItemsFromBoard(team, boardModel);
    }
};

VSS.register(VSS.getContribution().id, menuAction);
