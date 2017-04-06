import { WorkItemClassificationNode } from "TFS/WorkItemTracking/Contracts";

export interface ITeamAreaPath {
    value: string;
    includeChildren: boolean;
}
export interface ITeamAreaPaths {
    team: ITeam;
    areaPaths: ITeamAreaPath[];
}

export interface ITeam {
    description: string;
    name: string;
    id: string;
}

export interface ITeamOwnership {
    team: ITeam;
    includeChildren: boolean;
}

export interface ITeamNode extends WorkItemClassificationNode {
    owners: ITeamOwnership[];
    children: ITeamNode[];
}

function toTeamlessTeamNode(node: WorkItemClassificationNode): ITeamNode {
    return { ...node, owners: [], children: (node.children || []).map(c => toTeamlessTeamNode(c)) };
}

function toPathParts(areaPath: string): string[] {
    return areaPath.split("\\");
}

function getNode(teamNode: ITeamNode, pathParts: string[]) {
    while (pathParts.length > 1) {
        pathParts.shift();
        teamNode = teamNode.children.filter(c => c.name === pathParts[0])[0];
    }
    return teamNode;
}

function addTeam(teamNode: ITeamNode, ownership: ITeamOwnership, pathParts: string[]): void {
    getNode(teamNode, pathParts).owners.push(ownership);
}

export function buildTeamNodes(areaPaths: WorkItemClassificationNode, teamAreaPathsArr: ITeamAreaPaths[]): ITeamNode {
    const teamNode = toTeamlessTeamNode(areaPaths);
    for (let teamAreaPaths of teamAreaPathsArr) {
        for (let areaPath of teamAreaPaths.areaPaths) {
            const pathParts = toPathParts(areaPath.value);
            addTeam(teamNode, {team: teamAreaPaths.team, includeChildren: areaPath.includeChildren }, pathParts);
        }
    }
    console.log("teamNode", teamNode);
    return teamNode;
}

export class PathNotFound extends Error {
    constructor(message?: string) {
        super(message);
        this.name = "PathNotFound";
    }
}

export function getTeamsForAreaPath(areaPath: string, teamNode: ITeamNode): ITeam[] {
    const teams: ITeam[] = [];
    const pathParts = toPathParts(areaPath);
    while (pathParts.length > 0) {
        const currPart = pathParts.shift();
        if (!teamNode || currPart !== teamNode.name) {
            throw new PathNotFound(currPart);
        }
        for (let ownership of teamNode.owners) {
            if (pathParts.length === 0 || ownership.includeChildren) {
                teams.push(ownership.team);
            }
        }
        if (pathParts.length > 0) {
            teamNode = teamNode.children.filter(c => c.name === pathParts[0])[0];
        }
    }
    return teams;
}