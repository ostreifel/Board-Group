import Controls = require("VSS/Controls");
import Combos = require("VSS/Controls/Combos");

import RestClient = require("TFS/Work/RestClient");

export interface IBoardControlOptions {
    columnValue: string;
    // allowedColumnValues: string[];
    // setColumn: (columValue: string)=>IPromise<void>;
    laneValue:  string;
    // allowedLaneValues:  string[];
    // setLane: (laneValue: string)=>IPromise<void>;
    boardName: string;
    boardUrl: string;
}

export class BoardControl extends Controls.Control<IPromise<IBoardControlOptions>> {
    private column: Combos.Combo;
    private lane: Combos.Combo;
    public initialize() {
        this._options.then((options) => {this.initializeInternal(options)})

    }
    private initializeInternal(options: IBoardControlOptions) {
        let columnOptions: Combos.IComboOptions = {
            type: 'list',
            value: options.columnValue,
        };
        let laneOptions: Combos.IComboOptions = {
            type: 'list',
            value: options.laneValue,
        };

        let boardLink = $('<a/>').text(options.boardName)
            .attr({
                href: options.boardUrl, 
                target:"_parent"
            });

        this._element.append(boardLink);
        let boardFields = $('<div/>');
        boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Column'));
        this.column = <Combos.Combo>Controls.BaseControl.createIn(Combos.Combo, boardFields, columnOptions);
        boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Lane'));
        this.lane = <Combos.Combo>Controls.BaseControl.createIn(Combos.Combo, boardFields, laneOptions);
        this._element.append(boardFields);
    }

}