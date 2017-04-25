import { ITeamNode } from "./teamNode";
import { trackEvent } from "../events";

const formatVersion = 1;
const preferredTeamCollection = "preferred-team";
interface PreferenceDoc {
    id: string;
    team: string;
    formatVersion: number;
    __etag: -1;
}

export interface IPreferredTeamContext {
    projectId: string;
    workItemType: string;
    areaPath: string;
}

function toId({ projectId, workItemType, areaPath }: IPreferredTeamContext) {
    return `${VSS.getWebContext().user.id}.${projectId}.${workItemType}.${areaPath}`;
}

export function storeTeamPreference(context: IPreferredTeamContext, team: string): IPromise<string> {
    const teamDoc: PreferenceDoc = {
        id: toId(context),
        team,
        formatVersion,
        __etag: -1
    };
    return VSS.getService(VSS.ServiceIds.ExtensionData).then((dataService: IExtensionDataService) => {
        return dataService.setDocument(preferredTeamCollection, teamDoc).then((doc: PreferenceDoc) => doc.team);
    });
}
export function readTeamPreference(context: IPreferredTeamContext): IPromise<string | null> {
    return VSS.getService(VSS.ServiceIds.ExtensionData).then((dataService: IExtensionDataService) => {
        return dataService.getDocument(preferredTeamCollection, toId(context)).then((doc: PreferenceDoc) => {
            return doc.formatVersion === formatVersion ? doc.team : null;
        }, (error: TfsError): string | null => {
            const status = Number(error.status);
            // If collection has not been created yet;
            if (status === 404 ||
                // User does not have permissions
                status === 401) {
                return null;
            }
            throw error;
        });
    });
}

