import { WorkItemClassificationNode } from "TFS/WorkItemTracking/Contracts";

export interface ITeamAreaPaths {
    team: ITeam;
    areaPaths: string[];
}

export interface ITeam {
    description: string,
    name: string;
    id: string;
}

export interface ITeamNode extends WorkItemClassificationNode {
    teams: ITeam[];
}

export function buildTeamNodes(areaPaths: WorkItemClassificationNode, teamAreaPaths: ITeamAreaPaths[]): ITeamNode {
    throw Error("unimplemented");
}

export function getTeamsForAreaPath(areaPath: string, teamNode: ITeamNode): string[] {
    throw Error("unimplemented");
}