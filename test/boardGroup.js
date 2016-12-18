define(["require", "exports", "./BoardControl", "VSS/Controls", "TFS/WorkItemTracking/Services"], function (require, exports, BoardControl_1, Controls, Services_1) {
    "use strict";
    $(window).bind("keydown", function (event) {
        if (event.ctrlKey || event.metaKey) {
            if (String.fromCharCode(event.which).toLowerCase() === "s") {
                event.preventDefault();
                Services_1.WorkItemFormService.getService().then(function (service) { return service.beginSaveWorkItem($.noop, $.noop); });
            }
        }
    });
    var boardControl = Controls.BaseControl.createIn(BoardControl_1.BoardControl, $(".board-control"));
    var contextData = {
        onSaved: function (savedEventArgs) { return boardControl.onSaved(savedEventArgs); },
        onRefreshed: function () { return boardControl.onRefreshed(); },
        onLoaded: function (loadedArgs) { return boardControl.onLoaded(loadedArgs); }
    };
    VSS.register(VSS.getContribution().id, contextData);
});
