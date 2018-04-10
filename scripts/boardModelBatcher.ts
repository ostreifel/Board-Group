import { WorkItem } from "TFS/WorkItemTracking/Contracts";
import { getClient } from "TFS/WorkItemTracking/RestClient";

const batchSize = 200;

const queued: {[project: string]: {[id: string]: undefined}} = {};
const cached: {[project: string]: {[id: string]: PromiseLike<WorkItem>}} = {};
export async function getWorkItem(id: number, project: string | null, batchWindow?: number): Promise<WorkItem> {
    cached[project] = cached[project] || {}
    if (cached[project][id]) {
        return cached[project][id];
    }

    queued[project] = queued[project] || {};
    queued[project][id] = undefined;

    if (batchWindow) {
        await new Promise((resolve) => setTimeout(resolve, batchWindow));
    }
    if (!cached[project][id]) {
        // Just in case the cache was cleared during the batch window
        queued[project] = queued[project] || {};
        queued[project][id] = undefined;
        let ids = Object.keys(queued[project]).map((id) => +id);
        delete queued[project];

        while (ids.length > 0) {
            const idBatch = ids.slice(0, batchSize);
            ids = ids.slice(batchSize);
            const wisPromise = getClient().getWorkItems(idBatch, undefined, undefined, undefined, undefined, project).then((wis) => {
                const wiLookup: {[id: number]: WorkItem} = {};
                wis.forEach((wi) => wiLookup[wi.id] = wi);
                return wiLookup;
            });
            for (const id of idBatch) {
                cached[project][id] = wisPromise.then((wis) => wis[id]);
            }
        }
    }

    // Don't want stale work items lying around.
    setTimeout(() =>{
        delete cached[project][id];
    }, 1000);

    return cached[project][id];
}