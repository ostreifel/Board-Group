import { ITeamNode } from "./teamNode";

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
            console.log("error getting page form", error);
            // If collection has not been created yet;
            if (Number(error.status) === 404) {
                return null;
            }
            throw error;
        });
    });
}

