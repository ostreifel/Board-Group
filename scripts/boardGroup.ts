/// <reference types="vss-web-extension-sdk" />

import "promise-polyfill/src/polyfill";
import { BoardControl } from "./boardControl";
import * as Controls from "VSS/Controls";
import { IWorkItemNotificationListener } from "TFS/WorkItemTracking/ExtensionContracts";
import { WorkItemFormService } from "TFS/WorkItemTracking/Services";

// save on ctr + s
$(window).bind("keydown", async (event) => {
    if (event.ctrlKey || event.metaKey) {
        if (String.fromCharCode(event.which).toLowerCase() === "s") {
            event.preventDefault();
            const service = await WorkItemFormService.getService();
            service.beginSaveWorkItem($.noop, $.noop);
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