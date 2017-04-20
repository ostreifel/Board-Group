import { ITeamNode } from "./teamNode";
import { trackEvent } from "../events";

const formatVersion = 1;
const areaCollection = "area-mappings";
interface NodeDoc {
    id: string;
    node: ITeamNode;
    formatVersion: number;
    __etag: -1;
}

export function storeNode(projectId: string, node: ITeamNode): IPromise<ITeamNode> {
    const nodeDoc: NodeDoc = {
        id: projectId,
        node,
        formatVersion,
        __etag: -1
    };
    return VSS.getService(VSS.ServiceIds.ExtensionData).then((dataService: IExtensionDataService) => {
        return dataService.setDocument(areaCollection, nodeDoc).then((value: NodeDoc) => value.node);
    });
}
export function readNode(projectId: string): IPromise<ITeamNode | null> {
    return VSS.getService(VSS.ServiceIds.ExtensionData).then((dataService: IExtensionDataService) => {
        return dataService.getDocument(areaCollection, projectId).then((doc: NodeDoc) => {
            return doc.formatVersion === formatVersion ? doc.node : null;
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
    });
}

