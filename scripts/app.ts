import {BoardControl, IBoardControlOptions} from "./BoardControl";
import Controls = require("VSS/Controls");
import Q = require("q");
import {WITFormSvcHelper} from "./WITFormSvcHelper";

let witFormHelper = new WITFormSvcHelper();

let options: IBoardControlOptions = {
    columnValue: witFormHelper.getBoardColumn(),
    allowedColumnValues: witFormHelper.getBoardColumnAllowedValue(),
    setColumn: (columnValue: string)=>{
        var defer = Q.defer<void>();
        defer.resolve();
        return defer.promise;
    },
    laneValue: witFormHelper.getBoardLane(),
    allowedLaneValues: witFormHelper.getBoardLaneAllowedValue(),
    setLane: (laneValue: string)=>{
        var defer = Q.defer<void>();
        defer.resolve();
        return defer.promise;
    },
    boardName: "Board name",
    boardLink: "Board link",
};



Controls.Enhancement.registerEnhancement(BoardControl, '.board-control', options);

// Register context menu action provider
const publisherId = VSS.getExtensionContext().publisherId;
VSS.register(`${ publisherId }.vsts-extension-ts-seed-simple.board-work-item-form-group`, {});