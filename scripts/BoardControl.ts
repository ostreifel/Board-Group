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
    private columnDiv: JQuery;
    private column: Combo;
    private laneDiv: JQuery;
    private lane: Combo;
    public initialize() {
        this._element.append($('<p/>').text('No board found'));
        VSS.resize();
        this._options.then((options) => {this.initializeInternal(options)})

    }
    private initializeInternal(options: IBoardControlOptions) {
        let columnOptions: IComboOptions = {
            value: options.columnValue,
            source: options.allowedColumnValues,
            change: function() {
                var box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    options.setColumn(box.getInputText());
                }
            }
        };
        let laneOptions: IComboOptions = {
            value: options.laneValue,
            source: options.allowedLaneValues,
            change: function() {
                var box: Combo = this;
                if (box.getSelectedIndex() > -1) {
                    options.setLane(box.getInputText());
                }
            }
        };

        if (!options.boardName) {
            return;
        }
        this._element.html('')
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
        if (options.laneValue && options.allowedLaneValues.length > 1) {
            boardFields.append($('<label/>').addClass('workitemcontrol-label').text('Board Lane'));
            this.lane = <Combo>BaseControl.createIn(Combo, boardFields, laneOptions);
        }
        this._element.append(boardFields);
        VSS.resize();
    }
    public update(column: string, lane: string) {
        if (this.column) {
            this.column.setInputText(column);
        }
        if (this.lane) {
            this.lane.setInputText(lane);
        }
    }

}