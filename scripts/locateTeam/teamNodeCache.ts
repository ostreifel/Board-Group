import * as Q from "q";
import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { getClient as getCoreClient } from "TFS/Core/RestClient";
import { WebApiTeam, TeamContext } from "TFS/Core/Contracts";
import { getClient as getWITClient } from "TFS/WorkItemTracking/RestClient";
import { TreeStructureGroup, WorkItemClassificationNode } from "TFS/WorkItemTracking/Contracts";
import { ITeam, ITeamNode, ITeamAreaPaths, buildTeamNodes, getTeamsForAreaPath, PathNotFound } from "./teamNode";
import { storeNode, readNode } from "./teamNodeStorage";
import { trackEvent, IProperties, IMeasurements, ValueWithTimings } from "../events";
import { CachedValue } from "../cachedValue";
import { Timings } from "../timings";


function getTeams(projectId: string): IPromise<ITeam[]> {
    let deferred = Q.defer<ITeam[]>();
    let client = getCoreClient();
    let teams: ITeam[] = [];
    let top: number = 200;

    let getTeamDelegate = (project: string, skip: number) => {
        client.getTeams(project, top, skip).then((items: WebApiTeam[]) => {
            teams.push(...items.map(i => {
                return {
                    name: i.name,
                    id: i.id,
                    description: i.description
                };
            }));
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
    const timings = new Timings();
    return getTeams(projectId).then(teams => {
        timings.measure("teamsList");
        return Q.all(teams.map(team =>
            getTeamAreaPaths(projectId, team)
        )).then(teamPaths => {
            timings.measure("getTeamSettings");
            const value: ValueWithTimings<ITeamAreaPaths[]> = {
                value: teamPaths, properties: {teamCount: String(teams.length)}, measurements: timings.measurements
            };
            return value;
        });
    });
}

function getAreaPaths(projectId: string) {
    const timings = new Timings();
    return getWITClient().getClassificationNode(projectId, TreeStructureGroup.Areas, undefined, 1000000).then(areas => {
        timings.measure("areaPaths");
        const value: ValueWithTimings<WorkItemClassificationNode> = {
            value: areas,
            properties: {},
            measurements: timings.measurements
        }
        return value;
    });
}

export function rebuildCache(projectId: string, trigger: string): IPromise<ITeamNode> {
    if (projectId in teamNodeCache && teamNodeCache[projectId].isLoaded()) {
        delete teamNodeCache[projectId];
    }
    const cacheTimings = new Timings();
    return Q.all([getAreaPaths(projectId), getAllTeamAreapaths(projectId)]).then(([areaPaths, teamAreaPaths]) => {
        cacheTimings.measure("restCalls", false);
        const node = buildTeamNodes(areaPaths.value, teamAreaPaths.value);
        cacheTimings.measure("buildTeamNodes");
        cacheTimings.measure("totalTime", false);
        storeNode(projectId, node).then(node => {
            cacheTimings.measure("storeNode");
            trackEvent("RebuiltCache",
                { 
                    ...areaPaths.properties,
                    ...teamAreaPaths.properties,
                    trigger,
                    size: String(JSON.stringify(node).length)
                },
                {
                    ...areaPaths.measurements,
                    ...teamAreaPaths.measurements,
                    ...cacheTimings.measurements
                }
            );
        });
        return node;
    });
}

// Put the values in CachedValue classes so that multiple retrievals before the promise returns only triggers one get
const teamNodeCache: { [projectId: string]: CachedValue<ITeamNode> } = {};
export function getTeamNode(projectId: string): IPromise<ITeamNode> {
    if (!(projectId in teamNodeCache)) {
        teamNodeCache[projectId] = new CachedValue<ITeamNode>(() =>
            readNode(projectId).then((node) =>
                Q(node) || rebuildCache(projectId, "empty")
            )
        );
    }
    return teamNodeCache[projectId].getValue();
}

/**
 * Given an areapath get team ids.
 * Get from cache if possible.
 * Build cache if not available.
 * Invalidate cache if areapath is unkown.
 * @param areaPath 
 */
export function getTeamsForAreaPathFromCache(projectId: string, areaPath: string): IPromise<ITeam[]> {
    return getTeamNode(projectId).then((node: ITeamNode): IPromise<ITeam[]> => {
        try {
            return Q(getTeamsForAreaPath(areaPath, node));
        } catch (e) {
            if (e instanceof Error && e.name === "PathNotFound") {
                return rebuildCache(projectId, "areapath miss").then(node => {
                    return getTeamsForAreaPath(areaPath, node);
                });
            } else {
                throw e;
            }
        }
    });
}
