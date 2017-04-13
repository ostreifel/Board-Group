import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { BoardReference, Board } from "TFS/Work/Contracts";
import { CachedValue } from "./cachedValue";

const boardReferences: {[projectTeam: string]: CachedValue<BoardReference[]>} = {};
export function getBoardReferences(projectName: string, teamName: string) {
    console.log("getting board references", projectName, teamName);
    const key = `${projectName}/${teamName}`;
    if (!(key in boardReferences)) {
        boardReferences[key] = new CachedValue(() => getWorkClient().getBoards({
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
    console.log("getting board references", projectName, teamName, boardId);
    const key = `${projectName}/${teamName}/${boardId}`;
    if (!(key in boards)) {
        boards[key] = new CachedValue(() => getWorkClient().getBoard({
            project: projectName,
            projectId: projectName,
            team: teamName,
            teamId: teamName
        }, boardId));
    }
    return boards[key].getValue();
}
