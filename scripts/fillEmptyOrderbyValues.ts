import { WorkItem } from "TFS/WorkItemTracking/Contracts";
import { getClient } from "TFS/WorkItemTracking/RestClient";
import { getClient as getBatchClient } from "TFS/WorkItemTracking/BatchRestClient";
import { JsonPatchDocument, JsonPatchOperation, Operation } from "VSS/WebApi/Contracts";

import { areaPathField, witField } from "./fieldNames";

async function getWorkItems(wiql: string, count: number, fields: string[]): Promise<WorkItem[]> {
    const ids = (await getClient().queryByWiql({query: wiql}, null, null, null, 1)).workItems.map(({id}) => id);
    if (ids.length === 0) {
        return [];
    }
    return getClient().getWorkItems(ids, fields);
}

async function getWorkItemFieldValue<T>(wiql: string, field: string): Promise<T | null> {
    const wi = (await getWorkItems(wiql, 1, [field]))[0];
    return wi && wi.fields[field] as T;
}

export interface IUpdatedOrderFieldValues {
    max: number | null;
    min: number | null;
}

export async function fillEmptyOrderByValues(
    orderField: string,
    areaPath: string,
    wits: string[],
    boardColumn: string,
    columnValue: string,
): Promise<IUpdatedOrderFieldValues> {
    const columnFilter = `
    ${areaPathField}="${areaPath}"
    and ${witField} in (${wits.map((s) => `'${s}'`).join(",")})
    and ${boardColumn} = "${columnValue}"
`;

    const endValueWiql = `SELECT id from workitems
    where ${columnFilter}
    and ${orderField} <> ""
    ORDER BY ${orderField}
    `;

    const emptyFieldQuery = `SELECT id from workitems
    where ${columnFilter}
    and ${orderField} = ""
    ORDER BY ID
    `;

    const [initialMin, initialMax, wis] = await Promise.all([
        await getWorkItemFieldValue<number>(endValueWiql + " ASC", orderField),
        await getWorkItemFieldValue<number>(endValueWiql + " DESC", orderField),
        await getWorkItems(emptyFieldQuery, 1000, [orderField]),
    ]);
    let min = initialMin;
    let max = initialMax;
    if (wis.length !== 0) {
        const updates: ([number, JsonPatchDocument])[] = []
        let orderCounter = initialMax || 10000;
        min = Math.min(min, orderCounter);
        for (const wi of wis) {
            orderCounter += 10;
            const update: JsonPatchDocument & JsonPatchOperation[] = [{
                op: Operation.Add,
                path: `/fields/${orderField}`,
                value: orderCounter,
            } as JsonPatchOperation];
            updates.push([wi.id,update]);
        }
        max = Math.max(max, orderCounter);
        await getBatchClient().updateWorkItemsBatch(updates);
    }

    return { min, max };
}