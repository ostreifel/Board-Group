export class CachedValue<T> {
    private isValueSet: boolean = false;
    private deferred: Promise<T>;
    constructor(private readonly generator: () => Promise<T>) {}
    public async getValue(): Promise<T> {
        if (!this.deferred) {
            this.deferred = this.generator();
            this.isValueSet = true;
        }
        return this.deferred;
    }
    public isLoaded() {
        return this.isValueSet;
    }
}
