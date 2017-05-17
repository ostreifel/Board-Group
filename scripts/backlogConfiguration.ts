import { getClient as getWorkClient } from "TFS/Work/RestClient";
import { TeamSetting, BacklogConfiguration } from "TFS/Work/Contracts";
import { TeamContext } from "TFS/Core/Contracts";
import { CachedValue } from "./cachedValue";
import * as Q from "q";

const settings: {
    [projectName: string]: {
        [teamName: string]: {
            backlogConfigurationData: CachedValue<BacklogConfiguration>
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
            backlogConfigurationData: new CachedValue(() => getWorkClient().getBacklogConfigurations(teamContext)),
            teamSettingsData: new CachedValue(() => getWorkClient().getTeamSettings(teamContext))
        };
    }
}

export function getEnabledBoards(projectName: string, teamName: string) {
    loadSettings(projectName, teamName);
    const { backlogConfigurationData, teamSettingsData } = settings[projectName][teamName];
    return Q.all([
        backlogConfigurationData.getValue(),
        teamSettingsData.getValue()
    ]).then(([backlogSettings, teamSettings]) => {
        return [
            ...backlogSettings.portfolioBacklogs,
            backlogSettings.requirementBacklog,
            backlogSettings.taskBacklog
        ].filter(backlog => teamSettings.backlogVisibilities[backlog.id]).map(b => b.name);
    });
}
