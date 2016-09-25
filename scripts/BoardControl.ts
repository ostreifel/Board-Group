import {Control, BaseControl} from "VSS/Controls";
import {Combo, IComboOptions} from "VSS/Controls/Combos";

export interface IBoardControlOptions {
    columnValue: string;
    allowedColumnValues: string[];
    setColumn: (columValue: string)=>IPromise<boolean>;
    laneValue:  string;
    allowedLaneValues:  string[];
    setLane: (laneValue: string)=>IPromise<boolean>;
    boardName: string;
    boardUrl: string;
}

export class BoardControl extends Control<IPromise<IBoardControlOptions>> {
    private column: Combo;
    private lane: Combo;
    public initialize() {
        this._options.then((options) => {this.initializeInternal(options)})

    }
    private initializeInternal(options: IBoardControlOptions) {
        let columnOptions: IComboOptions = {
            value: options.columnValue,
            type: 'list',
            allowEdit: false
            // source: options.allowedColumnValues,
            // change: function() {
            //     var box: Combo = this;
            //     if (box.getSelectedIndex() > -1) {
            //         options.setColumn(box.getInputText());
            //     }
            // }
        };
        let laneOptions: IComboOptions = {
            value: options.laneValue,
            mode: 'string',
            allowEdit: false
            // type: 'list',
            // source: options.allowedLaneValues,
            // change: function() {
            //     var box: Combo = this;
            //     if (box.getSelectedIndex() > -1) {
            //         options.setLane(box.getInputText());
            //     }
            // }
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
            this.column = <Combo>BaseControl.createIn(Combo, boardFields, columnOptions);
        }
        if (options.laneValue) {
            boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Lane'));
            this.lane = <Combo>BaseControl.createIn(Combo, boardFields, laneOptions);
        }
        this._element.append(boardFields);
    }

}