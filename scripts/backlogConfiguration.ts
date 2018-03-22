import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { TeamSetting, BacklogConfiguration } from "TFS/Work/Contracts";
import { TeamContext } from "TFS/Core/Contracts";
import { CachedValue } from "./cachedValue";

const settings: {
    [projectName: string]: {
        [teamName: string]: {
            backlogConfigurationData: CachedValue<BacklogConfiguration | null>
            teamSettingsData: CachedValue<TeamSetting>
        }
    }
} = {};

function loadSettings(projectName: string, teamName: string) {
    if (!(projectName in settings)) {
        settings[projectName] = {};
    }
    if (!(teamName in settings[projectName])) {
        const teamContext: TeamContext = {
            project: "",
            projectId: projectName,
            team: teamName,
            teamId: teamName
        };
        settings[projectName][teamName] = {
            backlogConfigurationData: new CachedValue(async () => {
                if (getWorkClient().getBacklogConfigurations) {
                    return await getWorkClient().getBacklogConfigurations(teamContext);
                } else {
                    return null;
                }
            }),
            teamSettingsData: new CachedValue(async () => getWorkClient().getTeamSettings(teamContext))
        };
    }
}

export async function getEnabledBoards(projectName: string, teamName: string): Promise<(board: string) => boolean> {
    loadSettings(projectName, teamName);
    const { backlogConfigurationData, teamSettingsData } = settings[projectName][teamName];
    const [backlogSettings, teamSettings] = await Promise.all([
        backlogConfigurationData.getValue(),
        teamSettingsData.getValue()
    ]);
    const boards = backlogConfigurationData ? null : [
        ...backlogSettings.portfolioBacklogs,
        backlogSettings.requirementBacklog,
        backlogSettings.taskBacklog
    ].filter(backlog => teamSettings.backlogVisibilities[backlog.id]).map(b => b.name);
    return (board: string) => !boards || boards.indexOf(board) >= 0;
}
