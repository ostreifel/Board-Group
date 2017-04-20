
export interface ValueWithTimings<T> {
    value: T;
    properties: IProperties;
    measurements: IMeasurements;
}
export interface IProperties {
    [name: string]: string;
}
export interface IMeasurements {
    [name: string]: number;
}

export function trackEvent(name: string, properties?: IProperties, measurements?: IMeasurements) {
    const insights = getInsights();
    if (insights) {
        properties = { ...(properties || {}), host: VSS.getWebContext().host.authority };
        insights.trackEvent(name, properties, measurements);
        insights.flush();
    }
}
function getInsights(): Microsoft.ApplicationInsights.IAppInsights | undefined {
    return window["appInsights"];
}
