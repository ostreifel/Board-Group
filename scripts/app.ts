import {BoardControl, IBoardControlOptions} from "./BoardControl";
import Controls = require("VSS/Controls");

let options: IBoardControlOptions = {
    columnValue: "Sample column value",
    allowedColumnValues: ["Sample column value", "Sample column value2"],
    setColumn: (columnValue: string)=>{
        var defer = Q.defer<string>();
        defer.resolve(columnValue);
        return defer.promise;
    },
    laneValue: "Sample lane value",
    allowedLaneValues: ["Sample lane value", "Sample lane value2"],
    setLane: (columnValue: string)=>{
        var defer = Q.defer<string>();
        defer.resolve(columnValue);
        return defer.promise;
    },
    boardName: "Board name",
    boardLink: "Board link"
};
Controls.Enhancement.registerEnhancement(BoardControl, '.board-control', options);

// Register context menu action provider
const publisherId = VSS.getExtensionContext().publisherId;
VSS.register(`${ publisherId }.vsts-extension-ts-seed-simple.board-work-item-form-group`, {});