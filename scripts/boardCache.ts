import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { BoardReference, Board } from "TFS/Work/Contracts";
import { CachedValue } from "./cachedValue";

const boardReferences: {[projectTeam: string]: CachedValue<BoardReference[]>} = {};
export async function getBoardReferences(projectName: string, teamName: string) {
    const key = `${projectName}/${teamName}`;
    if (!(key in boardReferences)) {
        boardReferences[key] = new CachedValue(async () => getWorkClient().getBoards({
            project: projectName,
            projectId: projectName,
            team: teamName,
            teamId: teamName
        }));
    }
    return boardReferences[key].getValue();
}

const boards: {[projectTeamId: string]: CachedValue<Board>} = {};
export function getBoard(projectName: string, teamName: string, boardId: string) {
    const key = `${projectName}/${teamName}/${boardId}`;
    if (!(key in boards)) {
        boards[key] = new CachedValue(async () => getWorkClient().getBoard({
            project: projectName,
            projectId: projectName,
            team: teamName,
            teamId: teamName
        }, boardId));
    }
    return boards[key].getValue();
}
