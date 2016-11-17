import {BoardControl, IBoardControlOptions} from "./BoardControl";
import Controls = require("VSS/Controls");
import Q = require("q");
import {IWorkItemFieldChangedArgs, IWorkItemNotificationListener} from "TFS/WorkItemTracking/ExtensionContracts";

let boardControl: BoardControl;
const refresh = () => {
    const container = $('.board-control')
    container.empty();
    boardControl = <BoardControl>Controls.BaseControl.createIn(BoardControl, container);
}

refresh();
VSS.register(VSS.getContribution().id, {
    // onFieldChanged: (fieldChangedArgs: IWorkItemFieldChangedArgs) => {
    //     const changes = fieldChangedArgs.changedFields;
    //     for (var referenceName in changes) {
    //         if (referenceName.match(/_Kanban.Column/)) {
    //             const column = changes[referenceName];
    //             const lane = changes[referenceName.replace('Column', 'Lane')] || '(Default Lane)';
    //             boardControl.update(column, lane);
    //             break;
    //         }
    //     }
    // },
    // onRefreshed: refresh,
    // onReset: refresh
});