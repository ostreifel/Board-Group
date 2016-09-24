import {WorkItemFormService} from "TFS/WorkItemTracking/Services";
import {IBoardControlOptions} from "./BoardControl";
import Q = require("q");
import RestClient = require("TFS/Work/RestClient");
import {TeamContext} from "TFS/Core/Contracts";

export function getBoardOptions() {
    let boardOptions: IBoardControlOptions= {
            // allowedColumnValues: null,
            // allowedLaneValues: null,
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


    WorkItemFormService.getService().then((service) => {
        // Get the current values for board info
        service.getFieldValues(["System.BoardColumn","System.BoardLane"]).then( (values) => {

            boardOptions.columnValue = <string>values["System.BoardColumn"];
            boardOptions.laneValue = <string>values["System.BoardLane"];
            resolveIfDone();
        }, rejectOnError)
    }, rejectOnError);

    
    var teamContext: TeamContext = {
        project : VSS.getWebContext().project.name,
        projectId : VSS.getWebContext().project.id,
        team : VSS.getWebContext().team.name,
        teamId : VSS.getWebContext().team.id
    };
    var boardName = "";
    var client = RestClient.getClient();
    console.log("pageContext:");
    console.log(VSS.getWebContext().host.uri);


    client.getBoards(teamContext).then(
        (boards) => {
            if (boards.length === 0) {
                rejectOnError("There were no boards");
                return;
            }
            boardOptions.boardName = boards[0].name;
            
            var accountName = VSS.getWebContext().account.name;
            var teamName = VSS.getWebContext().team.name;
            boardOptions.boardUrl = `http://${window.location.host}/${teamName}/_backlogs/board/${this.boardOptions.boardName}`;
            resolveIfDone();
        }, rejectOnError);
    return optionsDeferred.promise;
}