import Controls = require("VSS/Controls");
import {WITFormSvcHelper} from "./WITFormSvcHelper";
import Combos = require("VSS/Controls/Combos");

import RestClient = require("TFS/Work/RestClient");

export interface IBoardControlOptions {
    columnValue: IPromise<string>;
    allowedColumnValues: IPromise<string[]>;
    setColumn: (columValue: string)=>IPromise<void>;
    laneValue:  IPromise<string>;
    allowedLaneValues:  IPromise<string[]>;
    setLane: (laneValue: string)=>IPromise<void>;
    boardName: string;
    boardLink: string;
}

export class BoardControl extends Controls.Control<IBoardControlOptions> {
    private column: Combos.Combo;
    private lane: Combos.Combo;
    public initialize() {


        var teamContext = {
            project : VSS.getWebContext().project.name,
            projectId : VSS.getWebContext().project.id,
            team : VSS.getWebContext().team.name,
            teamId : VSS.getWebContext().team.id
        };
        var boardName = "";
        var client = RestClient.getClient();
        client.getBoards(teamContext).then(
            function(boards) {
                for(var i=0;i<boards.length;i++) {
                    var b = boards[i];
                    console.log(b.url, b.name, b.id);
                    boardName = b.name;
                }
            }   
        );
        var accountName = VSS.getWebContext().account.name;
        var teamName = VSS.getWebContext().team.name;
        
        var boardUrl = "http://" + accountName + ".visualstudio.com/" + teamName + "/_backlogs/board/" + boardName;
        console.log(boardUrl);


        let columnOptions: Combos.IComboOptions = {
            type: 'list',
            source: allowedColumnValues,
            value: columnValue,
            change: () => {
                let columnValue = this.lane.getInputText();
                if (allowedColumnValues.indexOf(columnValue) === -1) {
                    return;
                } 
                console.log(`Setting the column value to ${columnValue}`)
                this._options.setColumn(columnValue)
                .then(() => {
                    console.log(`Set the column value to ${columnValue}`)
                });
            },


        };
        let laneOptions: Combos.IComboOptions = {
            type: 'list',
            source: allowedLaneValues,
            value: laneValue,
            change: () => {
                let laneValue = this.lane.getInputText();
                if (allowedLaneValues.indexOf(laneValue) === -1) {
                    return;
                } 
                console.log(`Setting the lane value to ${laneValue}`);
                this._options.setLane(laneValue)
                .then(() => {
                    console.log(`Set the lane value to ${laneValue}`);
                });
            }
        };

        let boardLink = $('<a/>').text(this._options.boardName)
            .attr({
                href: boardUrl, 
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