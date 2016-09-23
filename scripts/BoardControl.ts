import Controls = require("VSS/Controls");
import Combos = require("VSS/Controls/Combos");

export interface IBoardControlOptions {
    columnValue: string;
    allowedColumnValues: string[];
    setColumn: (columValue: string)=>IPromise<void>;
    laneValue: string;
    allowedLaneValues: string[];
    setLane: (laneValue: string)=>IPromise<void>;
    boardName: string;
    boardLink: string;

}
export class BoardControl extends Controls.Control<IBoardControlOptions> {
    private column: Combos.Combo;
    private lane: Combos.Combo;
    public initialize() {
        let columnOptions: Combos.IComboOptions = {
            type: 'list',
            source: this._options.allowedColumnValues,
            value: this._options.columnValue,
            change: () => {
                let columnValue = this.lane.getInputText();
                console.log(`Setting the column value to ${columnValue}`)
                this._options.setColumn(columnValue)
                .then(() => {
                    console.log(`Set the column value to ${columnValue}`)
                });
            },


        };
        let laneOptions: Combos.IComboOptions = {
            type: 'list',
            source: this._options.allowedLaneValues,
            value: this._options.laneValue,
            change: () => {
                let laneValue = this.lane.getInputText();
                console.log(`Setting the lane value to ${laneValue}`);
                this._options.setLane(laneValue)
                .then(() => {
                    console.log(`Set the lane value to ${laneValue}`);
                });
            }
        };

        let boardLink = $('<a/>').text(this._options.boardName)
            .attr("href", this._options.boardLink); 
        this._element.append(boardLink);
        let boardFields = $('<div/>');
        boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Column'));
        this.column = <Combos.Combo>Controls.BaseControl.createIn(Combos.Combo, boardFields, columnOptions);
        boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Lane'));
        this.lane = <Combos.Combo>Controls.BaseControl.createIn(Combos.Combo, boardFields, laneOptions);
        this._element.append(boardFields);
    }

}