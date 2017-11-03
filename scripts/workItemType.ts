import * as Q from "q";
import { getClient } from "TFS/WorkItemTracking/RestClient";
import { WorkItemType } from "TFS/WorkItemTracking/Contracts";

const cache: {[project: string]: {[wit: string]: Q.IPromise<WorkItemType>}} = {};
export function getWorkItemType(project: string, witName: string): Q.IPromise<WorkItemType> {
    if (!(project in cache)) {
        cache[project] = {};
    }
    if (!(witName in cache[project])) {
        cache[project][witName] = getClient().getWorkItemType(project, witName);
    }
    return cache[project][witName];
}