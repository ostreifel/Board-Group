import { IMeasurements } from "./events";
export class Timings {
    private readonly start: number = performance.now();
    public readonly measurements: IMeasurements = {};
    private previous = this.start;
    public measure(name: string, sincePrevious = true) {
        const now = performance.now();
        this.measurements[name] = now - (sincePrevious ? this.previous: this.start);
        this.previous = now;
    }
}