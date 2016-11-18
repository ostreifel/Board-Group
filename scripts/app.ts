import {BoardControl, IBoardControlOptions} from "./BoardControl";
import Controls = require("VSS/Controls");
import Q = require("q");
import {IWorkItemFieldChangedArgs, IWorkItemNotificationListener} from "TFS/WorkItemTracking/ExtensionContracts";

const boardControl = <BoardControl>Controls.BaseControl.createIn(BoardControl, $('.board-control'));

const contextData = <IWorkItemNotificationListener>{};
contextData.onSaved = (savedEventArgs) => boardControl.onSaved(savedEventArgs);
contextData.onFieldChanged = (fieldChangedArgs) => boardControl.onFieldChanged(fieldChangedArgs);
contextData.onReset = () => boardControl.onReset();
contextData.onRefreshed = () => boardControl.onRefreshed();
VSS.register(VSS.getContribution().id, contextData);