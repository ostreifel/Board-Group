import {BoardControl, IBoardControlOptions} from "./BoardControl";
import Controls = require("VSS/Controls");
import Q = require("q");
import {IWorkItemFieldChangedArgs, IWorkItemNotificationListener} from "TFS/WorkItemTracking/ExtensionContracts";
import { WorkItemFormService, IWorkItemFormService } from "TFS/WorkItemTracking/Services";

// Save on ctr + s
$(window).bind('keydown', function(event) {
    if (event.ctrlKey || event.metaKey) {
        if (String.fromCharCode(event.which).toLowerCase() === 's') {
            event.preventDefault();
            WorkItemFormService.getService().then((service)=>service.beginSaveWorkItem($.noop, $.noop));
        }
    }
});

const boardControl = <BoardControl>Controls.BaseControl.createIn(BoardControl, $('.board-control'));

const contextData = <IWorkItemNotificationListener>{};
contextData.onSaved = (savedEventArgs) => boardControl.onSaved();
contextData.onFieldChanged = (fieldChangedArgs) => boardControl.onFieldChanged(fieldChangedArgs);
contextData.onReset = () => boardControl.onReset();
contextData.onRefreshed = () => boardControl.onRefreshed();
VSS.register(VSS.getContribution().id, contextData);