import {BoardControl, IBoardControlOptions} from "./BoardControl";
import Controls = require("VSS/Controls");
import Q = require("q");
import {getBoardOptions} from "./getBoardOptions";
import {IWorkItemFieldChangedArgs, IWorkItemNotificationListener} from "TFS/WorkItemTracking/ExtensionContracts";

let boardControl: BoardControl;
let refresh = () => {
    let container = $('.board-control')
    container.empty();
    boardControl = <BoardControl>Controls.BaseControl.createIn(BoardControl, container, getBoardOptions());
}

refresh();
// Register context menu action provider
const publisherId = VSS.getExtensionContext().publisherId;
VSS.register(`${ publisherId }.board-group.board-work-item-form-group`, {
    onFieldChanged: (fieldChangedArgs: IWorkItemFieldChangedArgs) => {
        let changes = fieldChangedArgs.changedFields;
        console.log(changes);
        for (var referenceName in changes) {
            if (referenceName.match(/_Kanban.Column/)) {
                let column = changes[referenceName];
                let lane = changes[referenceName.replace('Column', 'Lane')] || '(Default Lane)';
                boardControl.update(column, lane);
                break;
            }
        }
    },
    onRefreshed: refresh,
    onReset: refresh
});