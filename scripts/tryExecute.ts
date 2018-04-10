import { trackEvent } from "./events";


/** execute of  */
export async function tryExecute<T>(command: string, callback: () => Promise<T>): Promise<T> {
    let message: string = "";
    try {
        const val = await callback();
        setStatus("");
        return val;
    } catch (error) {
        message = (
            typeof error === "string" ? error : (error.serverError || error || {}).message
        ) ||
        (error && error["value"] && error["value"]["message"]) ||
        error + "" ||
        "unknown error";

        // tslint:disable-next-line:no-console
        console.error(error);
        trackEvent("error", {message, command, stack: error && error.stack, status: getStatus()});
        setStatus("");
        throw message;
    }
}

let status: string = "";
export function setStatus(message: string) {
    status = message;
}

export function getStatus() {
    return status;
}