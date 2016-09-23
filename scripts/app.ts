import Controls = require("VSS/Controls");

export class BoardControl extends Controls.BaseControl {
    private columnValue: JQuery;
    private laneValue: JQuery;
    public initialize() {
        this.columnValue = $('<div/>').text("Sample Column");
        this.laneValue = $('<div/>').text("Sample Column");
        var boardLink = "sample link";
        this._element
            .append($('<a/>').text("Sample board link").attr("href", boardLink))
            .append($('<h4/>').text('Board Column'))
            .append(this.columnValue)
            .append($('<h4/>').text('Board Lane'))
            .append(this.laneValue);
    }

}

Controls.Enhancement.registerEnhancement(BoardControl, '.board-control');

// Register context menu action provider
const publisherId = VSS.getExtensionContext().publisherId;
VSS.register(`${ publisherId }.vsts-extension-ts-seed-simple.board-work-item-form-group`, {});