import {BoardControl, IBoardControlOptions} from "./BoardControl";
import Controls = require("VSS/Controls");
import Q = require("q");
import {getBoardOptions} from "./getBoardOptions";
import {IWorkItemFieldChangedArgs, IWorkItemNotificationListener} from "TFS/WorkItemTracking/ExtensionContracts";

Controls.Enhancement.registerEnhancement(BoardControl, '.board-control', getBoardOptions());

let refresh = () => {
    let container = $('.board-control')
    container.empty();
    Controls.BaseControl.createIn(BoardControl, container, getBoardOptions());
}

// Register context menu action provider
const publisherId = VSS.getExtensionContext().publisherId;
VSS.register(`${ publisherId }.board-group.board-work-item-form-group`, {
    onRefreshed: refresh,
    onReset: refresh
});