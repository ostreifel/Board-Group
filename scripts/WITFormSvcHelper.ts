import {WorkItemFormService} from "TFS/WorkItemTracking/Services";
import Q = require("q");

export class WITFormSvcHelper {

    private _getWorkItemFormService() {
        return WorkItemFormService.getService();
    }

    private _getAllowedFieldValues(fieldName: string): IPromise<string[]> {
        var defer = Q.defer<any>();
        //get allowed value for BoardColumn, BoardColumnDone, and BoardLane
        this._getWorkItemFormService().then(function (service) {
            // Get the current values for board info
            service.getAllowedFieldValues(fieldName).then(
                function (value) {
                    defer.resolve(value);
                })
        });
        return defer.promise;
    }

    private _getFieldValues(fields: string[]): any {
        var defer = Q.defer<any>();
        this._getWorkItemFormService().then(function (service) {
            // Get the current values for board info
            service.getFieldValues(fields).then(
                function (value) {
                    defer.resolve(value);
                });
        });
        return defer.promise;
    }

    private _setFieldValue(fieldName: string, selected: string): IPromise<boolean> {
        //put to changedfields
        var defer = Q.defer<boolean>();
        this._getWorkItemFormService().then(function (service) {
            service.setFieldValue(fieldName, selected).then((value) => {
                defer.resolve(value);
            });
        });
        return defer.promise;
    }

    public SetBoardColumn(value: string): IPromise<boolean> {
        var defer = Q.defer<boolean>();
        this._setFieldValue("System.BoardColumn", value).then((value) => {
            defer.resolve(value);

        }

        );
        return defer.promise;
    }

    public SetBoardLane(value: string): IPromise<boolean> {
        var defer = Q.defer<boolean>();
        this._setFieldValue("System.BoardLane", value).then((value) => {
            defer.resolve(value);
        });
        return defer.promise;
    }

    //To-Do: make field value cache inside to make one call in the end.
    public getBoardColumn(): IPromise<string> {
        var defer = Q.defer<any>();
        this._getFieldValues(["System.BoardColumn"]).then(function (value) {
            defer.resolve(value["System.BoardColumn"]);
        });
        return defer.promise;
    }

    public getBoardLane(): IPromise<string> {
        var defer = Q.defer<any>();
        this._getFieldValues(["System.BoardLane"]).then(function (value) {
            defer.resolve(value["System.BoardLane"]);
        });
        return defer.promise;
    }

    public getBoardColumnAllowedValue(): IPromise<string[]> {
        var defer = Q.defer<any>();
        this._getAllowedFieldValues("System.BoardColumn").then(function (value) {
            defer.resolve(value);
        });
        return defer.promise;
    }

    public getBoardLaneAllowedValue(): IPromise<string[]> {
        var defer = Q.defer<any>();
        this._getAllowedFieldValues("System.BoardLane").then(function (value) {
            defer.resolve(value);
        });
        return defer.promise;
    }
}