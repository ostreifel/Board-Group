import { BoardModel } from "./boardModel";
import * as Q from "q";
import { menuItemsFromBoard } from "./boardMenuItems";
import { trackEvent } from "./events";
import { Timings } from "./timings";

interface IBoardMappings {
    [key: string]: BoardModel[];
}

function createBacklogItems(teamName: string, boards: BoardModel[]): IContributedMenuItem[] {
    const boardMap: IBoardMappings = {};
    for (let board of boards) {
        if (!(board.getBoard().name in boardMap)) {
            boardMap[board.getBoard().name] = [];
        }
        boardMap[board.getBoard().name].push(board);
    }
    const bulkSave = boardName => (team, field, value) => {
        const bulkTimings = new Timings();
        return Q.all(boardMap[boardName].map(b => b.save(team, field, value))).then(voids => {
            bulkTimings.measure("totalTime");
            trackEvent("bulkUpdate", { workItemCount: String(boardMap[boardName].length) }, bulkTimings.measurements);
        });
    }
    if (Object.keys(boardMap).length === 1) {
        const boardName = Object.keys(boardMap)[0];
        return menuItemsFromBoard(teamName, boardMap[boardName][0], bulkSave(boardName));
    }
    const items: IContributedMenuItem[] = [];
    for (let boardName in boardMap) {
        items.push({
            text: boardName,
            childItems: menuItemsFromBoard(boardName, boardMap[boardName][0], bulkSave(boardName))
        });
    }
    return items;
}

function createTeamItems(boards: IBoardMappings): IContributedMenuItem[] {
    if (Object.keys(boards).length === 1) {
        const team = Object.keys(boards)[0];
        return createBacklogItems(team, boards[team]);
    }
    const items: IContributedMenuItem[] = [];
    for (let team in boards) {
        items.push({
            text: team,
            childItems: createBacklogItems(team, boards[team])
        });
    }
    return items;
}

function createMenuItems(workItemIds: number[]): IPromise<IContributedMenuItem[]> {
    const location = VSS.getContribution().id.match("board-query-bulk-edit$") ? "query" : "backlogs";
    const timings = new Timings();
    return Q.all(workItemIds.map(id => BoardModel.create(id, location))).then((boardModels: BoardModel[]) => {
        const teamToBoard: IBoardMappings = {};
        // Potential take the boards interesection rather than union.
        for (let boardModel of boardModels) {
            for (let team of boardModel.getTeams()) {
                if (!(team in teamToBoard)) {
                    teamToBoard[team] = [];
                }
                teamToBoard[team].push(boardModel);
            }
        }
        timings.measure("totalTime");
        trackEvent("bulkContextMenu", { workItemCount: String(workItemIds.length) }, timings.measurements);

        if (Object.keys(teamToBoard).length > 0) {
            const items = createTeamItems(teamToBoard);
            console.log("menu items", items);
            return items;
        } else {
            const items: IContributedMenuItem[] = [{
                text: "No associated boards",
                icon: "/img/smallLogo.png",
                disabled: true
            }];
            return items;
        }
    });
}
const actionProvider: IContributedMenuSource = {
    getMenuItems: ({ workItemIds }: { workItemIds: number[] }) => {
        return createMenuItems(workItemIds);
    }
};

// Register context menu action provider
VSS.register(VSS.getContribution().id, actionProvider);