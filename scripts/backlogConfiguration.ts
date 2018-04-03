import { TeamContext } from 'TFS/Core/Contracts';
import { BacklogConfiguration, TeamSetting } from 'TFS/Work/Contracts';
import { getClient as getWorkClient } from 'TFS/Work/RestClient';
import { projectField, witField, stateField } from './fieldNames';

const settings: {
    [projectName: string]: {
        [teamName: string]: {
            backlogConfigurationData: Promise<BacklogConfiguration | null>
            teamSettingsData: PromiseLike<TeamSetting>
        }
    }
} = {};

async function hardGetBacklogConfiguration(project: string): Promise<BacklogConfiguration | null> {
    if (getWorkClient().getBacklogConfigurations) {
        return await getWorkClient().getBacklogConfigurations({project} as TeamContext);
    } else {
        return null;
    }
}

const configsMap: {[project: string]: Promise<BacklogConfiguration | null>} = {};

export async function getBacklogConfiguration(project: string): Promise<BacklogConfiguration | null> {
    if (!configsMap.hasOwnProperty(project)) {
        configsMap[project] = hardGetBacklogConfiguration(project);
    }
    return configsMap[project];
}


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
            backlogConfigurationData: getBacklogConfiguration(projectName),
            teamSettingsData: getWorkClient().getTeamSettings(teamContext)
        };
    }
}

export async function getEnabledBoards(projectName: string, teamName: string): Promise<(board: string) => boolean> {
    loadSettings(projectName, teamName);
    const { backlogConfigurationData, teamSettingsData } = settings[projectName][teamName];
    const [backlogSettings, teamSettings] = await Promise.all([
        backlogConfigurationData,
        teamSettingsData
    ]);
    const boards = backlogConfigurationData ? null : [
        ...backlogSettings.portfolioBacklogs,
        backlogSettings.requirementBacklog,
        backlogSettings.taskBacklog
    ].filter(backlog => teamSettings.backlogVisibilities[backlog.id]).map(b => b.name);
    return (board: string) => !boards || boards.indexOf(board) >= 0;
}

export async function getOrderFieldName(project: string): Promise<string> {
    const config = await getBacklogConfiguration(project);
    if (!config) {
        return "System.";
    }
    return config.backlogFields.typeFields.Order;
}
