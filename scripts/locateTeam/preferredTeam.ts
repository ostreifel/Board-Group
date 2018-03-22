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
    return `${projectId}.${workItemType}.${areaPath}`.replace(/\\/g, '-');
}

export async function storeTeamPreference(context: IPreferredTeamContext, team: string): Promise<string> {
    const teamDoc: PreferenceDoc = {
        id: toId(context),
        team,
        formatVersion,
        __etag: -1
    };
    const dataService = await VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData);
    const doc: PreferenceDoc = await dataService.setDocument(preferredTeamCollection, teamDoc, {scopeType: "User"});
    return doc.team;
}
export async function readTeamPreference(context: IPreferredTeamContext): Promise<string | null> {
    const dataService = await VSS.getService<IExtensionDataService>(VSS.ServiceIds.ExtensionData);
    return dataService.getDocument(preferredTeamCollection, toId(context), {scopeType: "User"}).then((doc: PreferenceDoc) => {
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
}

