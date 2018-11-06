import * as React from "react";
import * as ReactDOM from "react-dom";
import { Icon } from "office-ui-fabric-react/lib/Icon";
import { initializeIcons } from "office-ui-fabric-react/lib/Icons";

initializeIcons();
export function createIcon(container: HTMLElement, iconName: string, click?: () => void ) {
    return new Promise<void>((resolve) => {
        const icon = <Icon iconName={iconName} onClick={click}/>;
        ReactDOM.render(icon, container, resolve);
    });
}
