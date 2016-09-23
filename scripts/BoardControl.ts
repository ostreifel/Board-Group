import Controls = require("VSS/Controls");

export interface IBoardControlOptions {
    columnValue: string;
    laneValue: string;
    boardName: string;
    boardLink: string;
}
export class BoardControl extends Controls.Control<IBoardControlOptions> {
    private columnValue: JQuery;
    private laneValue: JQuery;
    public initialize() {
        
        this.columnValue = $('<div/>').text(this._options.columnValue);
        this.laneValue = $('<div/>').text(this._options.laneValue);
        let boardLink = $('<a/>').text(this._options.boardName)
            .attr("href", this._options.boardLink); 
        this._element
            .append(boardLink)
            .append($('<h4/>').text('Board Column'))
            .append(this.columnValue)
            .append($('<h4/>').text('Board Lane'))
            .append(this.laneValue);
    }

}