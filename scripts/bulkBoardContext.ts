import { BoardModel } from "./boardModel";
import * as Q from "q";
import { menuItemsFromBoard } from "./boardMenuItems";
import { trackEvent, flushNow } from "./events";
import { Timings } from "./timings";
import { DelayedFunction } from "VSS/Utils/Core";

interface IBoardMappings {
    [key: string]: BoardModel[];
}

const refreshPage = new DelayedFunction(null, 100, "refreshPage", () => {
    VSS.getService(VSS.ServiceIds.Navigation).then(function (navigationService: IHostNavigationService) {
        navigationService.reload();
    });
})

function createBacklogItems(teamName: string, boards: BoardModel[]): IContributedMenuItem[] {
    const boardMap: IBoardMappings = {};
    for (let board of boards) {
        if (!(board.getBoard(teamName).name in boardMap)) {
            boardMap[board.getBoard(teamName).name] = [];
        }
        boardMap[board.getBoard(teamName).name].push(board);
    }
    const bulkSave = boardName => (team, field, value) => {
        const bulkTimings = new Timings();
        refreshPage.cancel();
        return Q.all(boardMap[boardName].map(b => b.save(team, field, value))).then(voids => {
            bulkTimings.measure("totalTime");
            trackEvent("bulkUpdate", { workItemCount: String(boardMap[boardName].length) }, bulkTimings.measurements);
            flushNow();
            refreshPage.reset();
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

function createTeamItems(boards: IBoardMappings, boardIds: string[]): IContributedMenuItem[] {
    if (Object.keys(boards).length === 1) {
        const team = Object.keys(boards)[0];
        return createBacklogItems(team, boards[team]);
    }
    const items: IContributedMenuItem[] = [];
    for (let team in boards) {
        items.push({
            text: team,
            icon: "img/logoIcon.png",
            childItems: createBacklogItems(team, boards[team])
        });
    }
    return items;
}

function commonBoards(boardModels: BoardModel[]): string[] {
    const boardIds: { [id: string]: boolean } = {};
    if (boardModels.length > 0) {
        for (const boardId of boardModels[0].getBoardIds()) {
            boardIds[boardId] = true;
        }
    }
    for (const board of boardModels) {
        for (const boardId in boardIds) {
            if (boardIds[boardId] && !board.getBoardIds().some(id => id === boardId)) {
                boardIds[boardId] = false;
            }
        }
    }
    return Object.keys(boardIds).filter(id => boardIds[id]);
}

function createMenuItems(workItemIds: number[]): IPromise<IContributedMenuItem[]> {
    const location = VSS.getContribution().id.match("board-query-bulk-edit$") ? "query" : "backlogs";
    const timings = new Timings();
    return Q.all(workItemIds.map(id => BoardModel.create(id, location))).then((boardModels: BoardModel[]) => {
        const teamToBoard: IBoardMappings = {};
        const boardIds = commonBoards(boardModels);
        for (let boardModel of boardModels) {
            for (let team of boardModel.getTeams()) {
                if (!boardIds.some(id => id === boardModel.getBoard(team).id)) {
                    continue;
                }
                if (!(team in teamToBoard)) {
                    teamToBoard[team] = [];
                }
                teamToBoard[team].push(boardModel);
            }
        }
        timings.measure("totalTime");
        trackEvent("bulkContextMenu", { workItemCount: String(workItemIds.length) }, timings.measurements);

        if (Object.keys(teamToBoard).length > 0) {
            const items = createTeamItems(teamToBoard, boardIds);
            console.log("menu items", items);
            return items;
        } else {
            const items: IContributedMenuItem[] = [{
                text: workItemIds.length > 1 ? "No common boards" : "No associated boards",
                icon: "/img/logoIcon.png",
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