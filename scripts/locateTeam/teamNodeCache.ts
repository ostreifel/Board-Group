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


async function getTeams(projectId: string): Promise<ITeam[]> {
    let client = getCoreClient();
    let teams: ITeam[] = [];
    const top: number = 200;
    let skip = 0;

    while (true) {
        const items = await client.getTeams(projectId, false, top, skip);
        teams.push(...items.map(i => {
            return {
                name: i.name,
                id: i.id,
                description: i.description
            };
        }));
        skip += top;
        if (items.length !== top) {
            break;
        }
    }
    return teams;
}

async function getTeamAreaPaths(projectId: string, team: ITeam): Promise<ITeamAreaPaths> {
    let teamContext: TeamContext = {
        project: "",
        projectId: projectId,
        team: team.name,
        teamId: team.id
    };

    const fieldValues = await getWorkClient().getTeamFieldValues(teamContext);
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
}

/**
 * Very expensive call, try to minimize
 * @param projectId 
 */
async function getAllTeamAreapaths(projectId: string) {
    const timings = new Timings();
    const teams = await getTeams(projectId)
    timings.measure("teamsList");
    const teamPaths = await Promise.all(teams.map(team =>
        getTeamAreaPaths(projectId, team)
    ));
    timings.measure("getTeamSettings");
    const value: ValueWithTimings<ITeamAreaPaths[]> = {
        value: teamPaths, properties: {teamCount: String(teams.length)}, measurements: timings.measurements
    };
    return value;
}

async function getAreaPaths(projectId: string) {
    const timings = new Timings();
    const areas = await getWITClient().getClassificationNode(projectId, TreeStructureGroup.Areas, undefined, 1000000);
    timings.measure("areaPaths");
    const value: ValueWithTimings<WorkItemClassificationNode> = {
        value: areas,
        properties: {},
        measurements: timings.measurements
    };
    return value;
}

export async function rebuildCache(projectId: string, trigger: string): Promise<ITeamNode> {
    if (projectId in teamNodeCache && teamNodeCache[projectId].isLoaded()) {
        delete teamNodeCache[projectId];
    }
    const cacheTimings = new Timings();
    const [areaPaths, teamAreaPaths] = await Promise.all([getAreaPaths(projectId), getAllTeamAreapaths(projectId)]);
    cacheTimings.measure("restCalls", false);
    const node = buildTeamNodes(areaPaths.value, teamAreaPaths.value);
    cacheTimings.measure("buildTeamNodes");
    cacheTimings.measure("totalTime", false);
    // async this - ui doesn't need to wait for the cache store
    storeNode(projectId, node).then(storedNode => {
        cacheTimings.measure("storeNode");
        trackEvent("RebuiltCache",
            { 
                ...areaPaths.properties,
                ...teamAreaPaths.properties,
                trigger,
                size: String(JSON.stringify(storedNode).length)
            },
            {
                ...areaPaths.measurements,
                ...teamAreaPaths.measurements,
                ...cacheTimings.measurements
            }
        );
    })
    return node;
}

const teamNodeCache: { [projectId: string]: CachedValue<ITeamNode> } = {};
export async function getTeamNode(projectId: string): Promise<ITeamNode> {
    if (!(projectId in teamNodeCache)) {
        teamNodeCache[projectId] = new CachedValue<ITeamNode>(async () => {
            const node = await readNode(projectId);
            return node || await rebuildCache(projectId, "empty")
        }
        );
    }
    return await teamNodeCache[projectId].getValue();
}

/**
 * Given an areapath get team ids.
 * Get from cache if possible.
 * Build cache if not available.
 * Invalidate cache if areapath is unkown.
 * @param areaPath 
 */
export async function getTeamsForAreaPathFromCache(projectId: string, areaPath: string): Promise<ITeam[]> {
    const node: ITeamNode = await getTeamNode(projectId);
    const teams = getTeamsForAreaPath(areaPath, node);
    if (teams instanceof PathNotFound) {
        const newNode = await rebuildCache(projectId, "areapath miss");
        return await getTeamsForAreaPath(areaPath, node) as ITeam[];
    }
    return teams;
}
