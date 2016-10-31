import {WorkItemFormService, IWorkItemFormService} from "TFS/WorkItemTracking/Services";
import {IBoardControlOptions} from "./BoardControl";
import Q = require("q");
import {getClient} from "TFS/Work/RestClient";
import {TeamContext} from "TFS/Core/Contracts";

export function getBoardOptions() {
    const boardOptions: IBoardControlOptions= {
            allowedColumnValues: null,
            allowedLaneValues: null,
            boardName: null,
            boardUrl: null,
            columnValue: null,
            laneValue: null,
            setColumn: null,
            setLane: null,
    };
    const optionsDeferred: Q.Deferred<IBoardControlOptions> = Q.defer<IBoardControlOptions>();

    const rejectOnError = (error: TfsError | string) => {
        optionsDeferred.reject(error)
    };

    const getBoardUrl = (service: IWorkItemFormService, referenceNames: string[]) => {
        let teamContext: TeamContext = {
            project : VSS.getWebContext().project.name,
            projectId : VSS.getWebContext().project.id,
            team : VSS.getWebContext().team.name,
            teamId : VSS.getWebContext().team.id
        };

        const client = getClient();
        client.getBoards(teamContext).then(
            (boards) => {
                if (boards.length === 0) {
                    rejectOnError("There are no boards");
                    return;
                }
                for (let boardReference of boards) {
                    client.getBoard(teamContext, boardReference.id).then((board) => {
                        if (referenceNames.indexOf(board.fields.columnField.referenceName) >= 0) {
                            
                            boardOptions.setColumn = (columnValue: string) =>
                                service.setFieldValue(board.fields.columnField.referenceName, columnValue);
                            boardOptions.setLane = (laneValue: string) =>
                                service.setFieldValue(board.fields.rowField.referenceName, laneValue);
                            boardOptions.boardName = board.name

                            const accountName = VSS.getWebContext().account.name;
                            const projectName = VSS.getWebContext().project.name;
                            const uri = VSS.getWebContext().host.uri;
                            boardOptions.boardUrl = `${uri}${projectName}/${teamContext.team}/_backlogs/board/${boardOptions.boardName}`;

                            boardOptions.allowedColumnValues = board.columns.map((column) => column.name);
                            boardOptions.allowedLaneValues = board.rows.map((row) => row.name || '(Default Lane)');
                            optionsDeferred.resolve(boardOptions);
                        }
                    }, rejectOnError);
                }
            }, rejectOnError);
    }

    WorkItemFormService.getService().then((service) => {
        // Get the current values for board info
        service.getFieldValues(["System.BoardColumn","System.BoardLane"]).then( (values) => {

            boardOptions.columnValue = <string>values["System.BoardColumn"];
            boardOptions.laneValue = <string>values["System.BoardLane"] || "(Default Lane)";
        }, rejectOnError)

        service.getFields().then((fields) => {
            const columnFields: string[] = [];
            for (let field of fields) {
                if (field.referenceName && field.referenceName.match(/_Kanban\.Column$/)) {
                    columnFields.push(field.referenceName);
                }
            }
            if (columnFields.length > 0) {
                getBoardUrl(service, columnFields);
            } else {
                rejectOnError('No associated board for current team');
            }
        }, rejectOnError)
    }, rejectOnError);

    return optionsDeferred.promise;
}