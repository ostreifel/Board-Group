export function trackEvent(name: string, properties?: {
    [name: string]: string;
}) {
    if (window["appInsights"]) {
        window["appInsights"].trackEvent(name, properties);
        window["appInsights"].flush();
    }
}
