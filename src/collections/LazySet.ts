
/**
 * Lazy set
 * 
 * @export
 * @class LazySet
 * @template T 
 */
export class LazySet<T> {
    /**
     * Set instance
     * 
     * @private
     */
    private set: Set<T>;

    /**
     * Creates an instance of LazySet.
     * @param [values] 
     */
    public constructor(values?: T[]) {
        this.set = new Set(values);
    }

    /**
     * Add value to the set
     * 
     * @param value 
     * @returns 
     */
    public async add(value: T): Promise<void> {
        this.set.add(value);
    }

    /**
     * Delete value from the set
     * 
     * @param value 
     * @returns 
     */
    public async delete(value: T): Promise<boolean> {
        return this.set.delete(value);
    }

    /**
     * Check if has value in the set
     * 
     * @param value 
     * @returns 
     */
    public async has(value: T): Promise<boolean> {
        return this.set.has(value);
    }

    /**
     * Get set size
     * 
     * @returns 
     */
    public async size(): Promise<number> {
        return this.set.size;
    }

    /**
     * Iterate over values
     */
    public async * values() {
        for (const val of this.set.values()) {
            yield val;
        }
    }

    /**
     * Iterate over values
     * 
     */
    public async * [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        for (const val of this.set) {
            yield val;
        }
    }

    public *[Symbol.iterator](): IterableIterator<T> {
        for (const val of this.set) {
            yield Promise.resolve(val) as any;
        }
    }
}