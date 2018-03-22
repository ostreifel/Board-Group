import { getClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItemType } from "TFS/WorkItemTracking/Contracts";

const cache: {[project: string]: {[wit: string]: IPromise<WorkItemType>}} = {};
export async function getWorkItemType(project: string, witName: string): Promise<WorkItemType> {
    if (!(project in cache)) {
        cache[project] = {};
    }
    if (!(witName in cache[project])) {
        cache[project][witName] = getClient().getWorkItemType(project, witName);
    }
    return await cache[project][witName];
}
