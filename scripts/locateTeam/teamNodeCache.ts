import * as Q from "q";
import {getClient as getWorkClient} from "TFS/Work/RestClient";
import {getClient as getCoreClient} from "TFS/Core/RestClient";
import {WebApiTeam, TeamContext} from "TFS/Core/Contracts";
import {getClient as getWITClient} from "TFS/WorkItemTracking/RestClient";
import {TreeStructureGroup, WorkItemClassificationNode} from "TFS/WorkItemTracking/Contracts";
import {ITeam, ITeamNode, ITeamAreaPaths, buildTeamNodes, getTeamsForAreaPath} from "./teamNode";
import {storeNode, readNode} from "./teamNodeStorage";


function getTeams(projectId: string): IPromise<ITeam[]> {
    let deferred = Q.defer<ITeam[]>();
    let client = getCoreClient();
    let teams: ITeam[] = [];
    let top: number = 200;

    let getTeamDelegate = (project: string, skip: number) => {
        client.getTeams(project, top, skip).then((items: WebApiTeam[]) => {
            teams.push(...items.map(i => {return {
                name: i.name,
                id: i.id,
                description: i.description
            }; }));
            if (items.length === top) {
                getTeamDelegate(project, skip + top);
            }
            else {
                deferred.resolve(teams);
            }
        });
    };
    getTeamDelegate(projectId, 0);
    return deferred.promise;
}

function getTeamAreaPaths(projectId: string, team: ITeam): IPromise<ITeamAreaPaths> {
        let teamContext: TeamContext = {
            project: "",
            projectId: projectId,
            team: team.name,
            teamId: team.id
        };
    
        return getWorkClient().getTeamFieldValues(teamContext).then((fieldValues) => {
            if (fieldValues.field.referenceName === "System.AreaPath") {
                return {
                    team,
                    areaPaths: fieldValues.values
                };
            }
            else {
                return {
                    team,
                    areaPaths: []
                };
            }
        });
}

/**
 * Very expensive call, try to minimize
 * @param projectId 
 */
function getAllTeamAreapaths(projectId: string) {
    return getTeams(projectId).then(teams => 
        Q.all(teams.map(team =>
            getTeamAreaPaths(projectId, team)
        ))
    )
}

function getAreaPaths(projectId: string): IPromise<WorkItemClassificationNode> {
    return getWITClient().getClassificationNode(projectId, TreeStructureGroup.Areas, undefined, 1000000);
}

export function rebuildCache(projectId: string): IPromise<ITeamNode> {
    return Q.all([getAreaPaths(projectId), getAllTeamAreapaths(projectId)]).then(([areaPaths, teamAreaPaths]) => {
        const node = buildTeamNodes(areaPaths, teamAreaPaths);
        return storeNode(projectId, node);
    });
}

/**
 * Given an areapath get team ids.
 * Get from cache if possible.
 * Build cache if not available.
 * Invalidate cache if areapath is unkown.
 * @param areaPath 
 */
export function getTeamsForAreaPathFromCache(projectId: string, areaPath: string): IPromise<ITeam[]> {
    return readNode(projectId).then(node => node || rebuildCache(projectId)).then((node: ITeamNode) => 
        getTeamsForAreaPath(projectId, node)
    );
}