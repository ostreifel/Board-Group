import {WorkItemFormService} from "TFS/WorkItemTracking/Services";
import {IBoardControlOptions} from "./BoardControl";
import Q = require("q");

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
    let optionsPromise: Q.Deferred<IBoardControlOptions> = Q.defer<IBoardControlOptions>();


    let resolveIfDone = () => {
        for (var key in this.boardOptions) {
            if (key === null) {
                return;
            }
        }
        this.optionsPromise.resolve(this.boardOptions);
    }


    WorkItemFormService.getService().then((service) => {
        // Get the current values for board info
        service.getFieldValues(["System.BoardColumn","System.BoardLane"]).then( (values) => {

            this.boardOptions.columnValue = values["System.BoardColumn"];
            this.boardOptions.laneValue = values["System.BoardLane"];
            resolveIfDone();
        })
    });
}