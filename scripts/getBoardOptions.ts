import {WorkItemFormService} from "TFS/WorkItemTracking/Services";
import {IBoardControlOptions} from "./BoardControl";
import Q = require("q");
import RestClient = require("TFS/Work/RestClient");
import {TeamContext} from "TFS/Core/Contracts";

export function getBoardOptions() {
    let boardOptions: IBoardControlOptions= {
            allowedColumnValues: null,
            allowedLaneValues: null,
            boardName: null,
            boardUrl: null,
            columnValue: null,
            laneValue: null,
            // setColumn: null,
            // setLane: null,
    };
    let optionsDeferred: Q.Deferred<IBoardControlOptions> = Q.defer<IBoardControlOptions>();


    let resolveIfDone = () => {
        for (var key in boardOptions) {
            if (boardOptions[key] === null) {
                return;
            }
        }
        optionsDeferred.resolve(boardOptions);
    }
    let rejectOnError = (error) => {optionsDeferred.reject(error)};


    let getBoardUrl = (referenceName: string) => {
        let teamContext: TeamContext = {
            project : VSS.getWebContext().project.name,
            projectId : VSS.getWebContext().project.id,
            team : VSS.getWebContext().team.name,
            teamId : VSS.getWebContext().team.id
        };

        let client = RestClient.getClient();
        client.getBoards(teamContext).then(
            (boards) => {
                if (boards.length === 0) {
                    rejectOnError("There were no boards");
                    return;
                }
                for (var i in boards) {
                    client.getBoard(teamContext, boards[i].id).then((board) => {
                        if (board.fields.columnField.referenceName === referenceName) {
                            boardOptions.boardName = board.name

                            var accountName = VSS.getWebContext().account.name;
                            var projectName = VSS.getWebContext().project.name;
                            var uri = VSS.getWebContext().host.uri;
                            boardOptions.boardUrl = `${uri}${projectName}/_backlogs/board/${boardOptions.boardName}`;

                            boardOptions.allowedColumnValues = board.columns.map((column) => column.name);
                            boardOptions.allowedLaneValues = board.rows.map((row) => row.name || '(Default Lane)');
                            resolveIfDone();
                        }
                    }, rejectOnError);
                }
            }, rejectOnError);
    }

    WorkItemFormService.getService().then((service) => {
        // Get the current values for board info
        service.getFieldValues(["System.BoardColumn","System.BoardLane"]).then( (values) => {

            boardOptions.columnValue = <string>values["System.BoardColumn"];
            boardOptions.laneValue = <string>values["System.BoardLane"];
            resolveIfDone();
        }, rejectOnError)

        service.getFields().then((fields) => {
            for (let i in fields) {
                var field = fields[i];
                if (field.referenceName && field.referenceName.match(/_Kanban\.Column$/)) {
                    getBoardUrl(field.referenceName);
                    return;
                }
            }
            boardOptions.boardName = boardOptions.boardUrl = "";
            resolveIfDone();
        }, rejectOnError)
    }, rejectOnError);

    return optionsDeferred.promise;
}