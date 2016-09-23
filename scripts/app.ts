import {BoardControl, IBoardControlOptions} from "BoardControl";
import Controls = require("VSS/Controls");

let options: IBoardControlOptions = {
    boardLink: "sample link",
    boardName: "Sample board name",
    columnValue: "Sample board column value",
    laneValue: "Sample board lane value"
    /** potentially a helper object here for callbacks */
};
Controls.Enhancement.registerEnhancement(BoardControl, '.board-control', options);

// Register context menu action provider
const publisherId = VSS.getExtensionContext().publisherId;
VSS.register(`${ publisherId }.vsts-extension-ts-seed-simple.board-work-item-form-group`, {});