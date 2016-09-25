import Controls = require("VSS/Controls");
import Combos = require("VSS/Controls/Combos");

import RestClient = require("TFS/Work/RestClient");

export interface IBoardControlOptions {
    columnValue: string;
    allowedColumnValues: string[];
    // setColumn: (columValue: string)=>IPromise<void>;
    laneValue:  string;
    allowedLaneValues:  string[];
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
            value: options.columnValue,
            type: 'list',
            source: options.allowedColumnValues
        };
        let laneOptions: Combos.IComboOptions = {
            value: options.laneValue,
            type: 'list',
            source: options.allowedLaneValues
        };

        if (!options.boardName) {
            this._element.append($('<p/>').text('No board found'));
            return;
        }
        let boardLink = $('<a/>').text(options.boardName)
            .attr({
                href: options.boardUrl, 
                target:"_parent"
            });

        this._element.append(boardLink).append($('<br><br>'));
        let boardFields = $('<div/>');
        if (options.columnValue) {
            boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Column'));
            this.column = <Combos.Combo>Controls.BaseControl.createIn(Combos.Combo, boardFields, columnOptions);
        }
        if (options.laneValue) {
            boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Lane'));
            this.lane = <Combos.Combo>Controls.BaseControl.createIn(Combos.Combo, boardFields, laneOptions);
        }
        this._element.append(boardFields);
    }

}