/**
 * Lazy map
 * 
 * @export
 * @class LazyMap
 * @template K 
 * @template V 
 */
export class LazyMap<K, V> {

    /**
     * Map backend instance for non initialized lazy map
     * 
     * @private
     */
    private map: Map<K, V>;

    /**
     * Creates an instance of LazyMap.
     * @param [entries] 
     */
    public constructor(entries?: Array<[K, V]>) {
        this.map = new Map(entries);
    }

    /**
     * Clear map
     * 
     * @param [deleteEntities=false] Also delete entties
     * @returns 
     */
    public async clear(deleteEntities: boolean = false): Promise<void> {
        this.map.clear();
    }

    /**
     * Delete value by key
     * 
     * @param key 
     * @param [deleteEntity=false] Also delete corresponding entity
     * @returns 
     */
    public async delete(key: K, deleteEntity: boolean = false): Promise<boolean> {
        return this.map.delete(key);
    }

    /**
     * Get value by key
     * 
     * @param key 
     * @returns 
     */
    public async get(key: K): Promise<V | undefined> {
        return this.map.get(key);
    }

    /**
     * Check if has value by key
     * 
     * @param key 
     * @returns 
     */
    public async has(key: K): Promise<boolean> {
        return this.map.has(key);
    }

    /**
     * Set new value
     * 
     * @param key 
     * @param value 
     * @returns 
     */
    public async set(key: K, value: V): Promise<void> {
        this.map.set(key, value);
    }

    /**
     * Map size
     * 
     * @returns 
     */
    public async size(): Promise<number> {
        return this.map.size;
    }

    /**
     * Keys iterator
     * 
     * @returns 
     */
    public async * keys(): AsyncIterableIterator<K> {
        for (const k of this.map.keys()) {
            yield k;
        }
    }

    /**
     * Values iterator
     * 
     * @returns 
     */
    public async * values(): AsyncIterableIterator<V> {
        for (const v of this.map.values()) {
            yield v;
        }
    }

    /**
     * Map iterator
     * 
     * @returns 
     */
    public async *[Symbol.asyncIterator](): AsyncIterableIterator<[K, V]> {
        for (const val of this.map) {
            yield val;
        }
    }
}