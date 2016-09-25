import {WorkItemFormService} from "TFS/WorkItemTracking/Services";
import {IBoardControlOptions} from "./BoardControl";
import Q = require("q");
import {getClient} from "TFS/Work/RestClient";
import {TeamContext} from "TFS/Core/Contracts";

export function getBoardOptions() {
    let boardOptions: IBoardControlOptions= {
            allowedColumnValues: null,
            allowedLaneValues: null,
            boardName: null,
            boardUrl: null,
            columnValue: null,
            laneValue: null,
            setColumn: null,
            setLane: null,
    };
    let optionsDeferred: Q.Deferred<IBoardControlOptions> = Q.defer<IBoardControlOptions>();

    let rejectOnError = (error) => {optionsDeferred.reject(error)};


    let getBoardUrl = (referenceName: string) => {
        let teamContext: TeamContext = {
            project : VSS.getWebContext().project.name,
            projectId : VSS.getWebContext().project.id,
            team : VSS.getWebContext().team.name,
            teamId : VSS.getWebContext().team.id
        };

        let client = getClient();
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
                            optionsDeferred.resolve(boardOptions);
                        }
                    }, rejectOnError);
                }
            }, rejectOnError);
    }

    WorkItemFormService.getService().then((service) => {
        boardOptions.setColumn = (columnValue: string) =>
            service.setFieldValue("System.BoardColumn", columnValue);
        boardOptions.setLane = (laneValue: string) =>
            service.setFieldValue("System.BoardLane", laneValue);
        
            
        // Get the current values for board info
        service.getFieldValues(["System.BoardColumn","System.BoardLane"]).then( (values) => {

            boardOptions.columnValue = <string>values["System.BoardColumn"];
            boardOptions.laneValue = <string>values["System.BoardLane"] || "(Default Lane)";
        }, rejectOnError)

        service.getFields().then((fields) => {
            for (let i in fields) {
                var field = fields[i];
                if (field.referenceName && field.referenceName.match(/_Kanban\.Column$/)) {
                    
                    boardOptions.setColumn = (columnValue: string) =>
                        service.setFieldValue(field.referenceName, columnValue);
                    let lane = field.referenceName.replace('Column', 'Lane');
                    boardOptions.setLane = (laneValue: string) =>
                        service.setFieldValue(lane, laneValue);

                    getBoardUrl(field.referenceName);
                    return;
                }
            }
            boardOptions.boardName = boardOptions.boardUrl = "";
        }, rejectOnError)
    }, rejectOnError);

    return optionsDeferred.promise;
}