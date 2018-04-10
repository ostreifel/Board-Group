import { WorkItem } from "TFS/WorkItemTracking/Contracts";
import { getClient } from "TFS/WorkItemTracking/RestClient";
import { BatchedCachedValue } from "./BatchedCachedValue";

export class BatchedWorkItems extends BatchedCachedValue<void, WorkItem> {
    constructor(delay: number, project: string) {
        super({
            generator: (queued) => getWorkItems(project, queued),
            delay,
            valueTimeout: 1000,
            batchSize: 200,
        });
    }
}

async function getWorkItems(project: string, queued: {[id: string]: void}): Promise<{[id: string]: WorkItem}> {
    const ids = Object.keys(queued).map((k) => +k);
    const wis = await getClient().getWorkItems(ids, undefined, undefined, undefined, undefined, project);
    const wiLookup: {[id: string]: WorkItem} = {};
    for (const wi of wis) {
        wiLookup[wi.id] = wi;
    }
    return wiLookup;
}

const batchers: {[project: string]: BatchedWorkItems} = {};
export function getWorkItem(id: number, project: string, delay: number) {
    if (!batchers[project]) {
        batchers[project] = new BatchedWorkItems(delay, project);
    }
    return batchers[project].getValue(id + "", undefined);
}