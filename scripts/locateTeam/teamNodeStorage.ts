import { ITeamNode } from "./teamNode";
import { trackEvent } from "../events";
import { setStatus } from "../tryExecute";

const formatVersion = 3;
const areaCollection = "area-mappings";
interface NodeDoc {
    id: string;
    node: ITeamNode;
    createdTime: number;
    formatVersion: number;
    __etag: -1;
}

export async function storeNode(projectId: string, node: ITeamNode): Promise<ITeamNode> {
    const nodeDoc: NodeDoc = {
        id: projectId,
        node,
        formatVersion,
        createdTime: Date.now(),
        __etag: -1
    };
    const dataService = await VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData);
    const value: NodeDoc = await dataService.setDocument(areaCollection, nodeDoc);
    return value.node;
}
export async function readNode(projectId: string): Promise<ITeamNode | null> {
    setStatus("reading team node from document service...");
    const dataService = await VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData);
    return dataService.getDocument(areaCollection, projectId).then((doc: NodeDoc) => {
        if (doc.formatVersion !== formatVersion) {
            return null;
        }
        if (doc.createdTime < Date.now() - (1000 * 60 * 60 * 24)) {
            return null;
        }
        return doc.node;
    }, (error: TfsError): ITeamNode | null => {
        console.log("error getting area node cache", error);
        const { message, name, stack, status, responseText } = error;
        trackEvent("readNodeCacheError", { message, name, stack, status, responseText });
        const statusNum = Number(status);
        // If collection has not been created yet;
        if (statusNum === 404 ||
        // User does not have permissions
        statusNum === 401) {
            return null;
        }
        throw error;
    });
}

