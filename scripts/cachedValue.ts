export class CachedValue<T> {
    private isValueSet: boolean = false;
    private deferred: Promise<T>;
    private loadedTime: number;
    constructor(
        private readonly generator: () => Promise<T>,
        /** Time out starts when request is started not when it's ended */
        private readonly timeout?: number,
    ) {}
    public async getValue(): Promise<T> {
        const currentTime = new Date().getTime();
        if (!this.deferred || (
            this.timeout &&
            (!this.loadedTime || this.loadedTime - currentTime > this.timeout)
        )) {
            this.loadedTime = currentTime;
            this.deferred = this.generator().then((v) => {
                this.isValueSet = true;
                return v;
            });
        }
        return this.deferred;
    }
    public isLoaded() {
        return this.isValueSet;
    }
}
