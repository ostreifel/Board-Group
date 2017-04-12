import { BoardControl } from "./boardControl";
import Controls = require("VSS/Controls");
import { IWorkItemNotificationListener } from "TFS/WorkItemTracking/ExtensionContracts";
import { WorkItemFormService } from "TFS/WorkItemTracking/Services";

// save on ctr + s
$(window).bind("keydown", function (event: JQueryEventObject) {
    if (event.ctrlKey || event.metaKey) {
        if (String.fromCharCode(event.which).toLowerCase() === "s") {
            event.preventDefault();
            WorkItemFormService.getService().then((service) => service.beginSaveWorkItem($.noop, $.noop));
        }
    }
});

const boardControl = <BoardControl>Controls.BaseControl.createIn(BoardControl, $(".board-control"));

const contextData: Partial<IWorkItemNotificationListener> = {
    onSaved: (savedEventArgs) => boardControl.onSaved(savedEventArgs),
    onRefreshed: () => boardControl.onRefreshed(),
    onLoaded: (loadedArgs) => boardControl.onLoaded(loadedArgs)
};

VSS.register(VSS.getContribution().id, contextData);