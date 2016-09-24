import {BoardControl, IBoardControlOptions} from "./BoardControl";
import Controls = require("VSS/Controls");
import Q = require("q");
import {getBoardOptions} from "./getBoardOptions";


let optionPromise: IPromise<IBoardControlOptions> = getBoardOptions();

Controls.Enhancement.registerEnhancement(BoardControl, '.board-control', optionPromise);

// Register context menu action provider
const publisherId = VSS.getExtensionContext().publisherId;
VSS.register(`${ publisherId }.vsts-extension-ts-seed-simple.board-work-item-form-group`, {});