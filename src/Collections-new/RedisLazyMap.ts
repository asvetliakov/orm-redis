import { getEntityFullId } from "../Metadata/Metadata";
import { EntityType, RedisManager } from "../Persistence/RedisManager";
import { LazyMap } from "./LazyMap";

export class RedisLazyMap<K, V> extends LazyMap<K, V> {
    /**
     * Manager instance
     * 
     * @private
     */
    private manager: RedisManager;

    /**
     * Map id
     * 
     * @private
     */
    private mapId: string;

    /**
     * Entity class
     * 
     * @private
     */
    private entityClass?: Function;

    /**
     * Cascade inserting
     * 
     * @private
     */
    private cascadeInsert: boolean;

    /**
     * Creates an instance of RedisLazyMap.
     * @param mapId Full map id in redis
     * @param manager Manager instance
     * @param [entityClass] If passed then map will be treated as entity map and will set/return entities
     * @param [cascadeInsert=false] True to automatically save entities
     */
    public constructor(mapId: string, manager: RedisManager, entityClass?: EntityType<V>, cascadeInsert: boolean = false) {
        super();
        this.manager = manager;
        this.mapId = mapId;
        this.entityClass = entityClass;
        this.cascadeInsert = cascadeInsert;
    }

    /**
     * Get map size
     * 
     * @returns 
     */
    public async size(): Promise<number> {
        return await this.manager.connection.client.hlenAsync(this.mapId);
    }

    /**
     * Set value
     * 
     * @param key 
     * @param value 
     * @returns 
     */
    public async set(key: K, value: V): Promise<void> {
        const serializedKey = this.manager.serializeSimpleValue(key);
        if (serializedKey) {
            if (this.entityClass) {
                const entityId = getEntityFullId(value as any);
                if (!entityId) {
                    throw new Error(`Unable to get entity id for key: ${key} and class ${this.entityClass.name}`);
                }
                if (this.cascadeInsert) {
                    // save entity
                    await this.manager.save(value as any);
                }
                // set mapping in map itself
                await this.manager.connection.client.hsetAsync(this.mapId, serializedKey, entityId);
            } else {
                const serializedVal = this.manager.serializeSimpleValue(value);
                if (serializedVal) {
                    this.manager.connection.client.hsetAsync(this.mapId, serializedKey, serializedVal);
                }
            }
        }
    }

    /**
     * Delete value by key
     * 
     * @param key 
     * @param [deleteEntity=false] Also delete corresponding entity
     * @returns 
     */
    public async delete(key: K, deleteEntity: boolean = false): Promise<boolean> {
        let res: number;
        const serializedKey = this.manager.serializeSimpleValue(key);
        if (!serializedKey) {
            return false;
        }
        if (this.entityClass) {
            if (deleteEntity) {
                const entityId = await this.manager.connection.client.hgetAsync(this.mapId, serializedKey);
                if (entityId) {
                    await this.manager.removeById(this.entityClass, entityId);
                }
            }
            res = await this.manager.connection.client.hdelAsync(this.mapId, serializedKey);
        } else {
            res = await this.manager.connection.client.hdelAsync(this.mapId, serializedKey);
        }
        return !!res;
    }

    /**
     * Check if the map has key
     * 
     * @param key 
     * @returns 
     */
    public async has(key: K): Promise<boolean> {
        const serializedKey = this.manager.serializeSimpleValue(key);
        if (!serializedKey) {
            return false;
        }
        if (this.entityClass) {
            // check also if we have this entity itself
            const entityId = await this.manager.connection.client.hgetAsync(this.mapId, serializedKey);
            if (!entityId) {
                return false;
            }
            return !! await this.manager.connection.client.existsAsync(entityId);
        } else {
            // simple checking by checking key
            return !! await this.manager.connection.client.hexistsAsync(this.mapId, serializedKey);
        }
    }

    /**
     * Get the value by given key
     * 
     * @param key 
     * @returns 
     */
    public async get(key: K): Promise<V | undefined> {
        const serializedKey = this.manager.serializeSimpleValue(key);
        if (!serializedKey) {
            return;
        }
        const val = await this.manager.connection.client.hgetAsync(this.mapId, serializedKey);
        if (!val) {
            return;
        }
        // return simple value if not entity map
        if (!this.entityClass) {
            return this.manager.unserializeSimpleValue(val);
        }
        // Load entity otherwise
        return await this.manager.load(this.entityClass, val) as any;
    }

    /**
     * Clear map
     * 
     * @param [deleteEntities=false] Also delete entties
     * @returns 
     */
    public async clear(deleteEntities: boolean = false): Promise<void> {
        if (this.entityClass && deleteEntities) {
            const values = await this.manager.connection.client.hvalsAsync(this.mapId);
            await this.manager.removeById(this.entityClass, values);
        }
        // delete map
        await this.manager.connection.client.delAsync(this.mapId);
    }

    /**
     * Convert map to array
     * 
     * @returns 
     */
    public async toArray(): Promise<Array<[K, V]>> {
        const res: Array<[K, V]> = [];
        for await (const pair of this) {
            res.push(pair);
        }
        return res;
    }

    /**
     * Iterate over map keys => values
     * 
     * @returns 
     */
    public async *[Symbol.asyncIterator](): AsyncIterableIterator<[K, V]> {
        let [cursor, results] = await this.manager.connection.client.hscanAsync(this.mapId, "0");
        const getResults = async (result: string[]): Promise<any[]> => {
            const unserializedKeys = result.reduce((keys, current, index) => {
                if (index % 2 === 0) {
                    keys.push(current);
                }
                return keys;
            }, [] as string[]).map(val => this.manager.unserializeSimpleValue(val));
            let vals: any[] = result.reduce((vals, current, index) => {
                if (index % 2) {
                    vals.push(current);
                }
                return vals;
            }, [] as string[]);

            if (this.entityClass) {
                // Loading will return only unique entities and since map can have different keys
                // pointed to the same value the we need to preserve the original order
                const entities = await this.manager.load(this.entityClass, vals) as any[];
                const entityMap = new Map<string, any>();
                for (const ent of entities) {
                    entityMap.set(getEntityFullId(ent)!, ent);
                }
                vals = vals.map(val => entityMap.get(val));
            } else {
                vals = vals.map(val => this.manager.unserializeSimpleValue(val));
            }

            return unserializedKeys.map((key, index) => [key, vals[index]]);
        };
        const res = await getResults(results);
        for (const keyVal of res) {
            yield keyVal;
        }

        while (cursor !== "0") {
            [cursor, results] = await this.manager.connection.client.hscanAsync(this.mapId, cursor);
            const res = await getResults(results);
            for (const keyVal of res) {
                yield keyVal;
            }
        }
    }

    /**
     * Iterate over map's keys
     * 
     * @returns 
     */
    public async * keys(): AsyncIterableIterator<K> {
        let [cursor, results] = await this.manager.connection.client.hscanAsync(this.mapId, "0");
        const getKeysFromResult = (result: string[]): any[] => {
            return results.reduce((keys, current, index) => {
                if (index % 2 === 0) {
                    keys.push(current);
                }
                return keys;
            }, [] as string[]).map(val => this.manager.unserializeSimpleValue(val));
        };
        let keys = getKeysFromResult(results);
        for (const key of keys) {
            yield key;
        }
        while (cursor !== "0") {
            [cursor, results] = await this.manager.connection.client.hscanAsync(this.mapId, cursor);
            keys = getKeysFromResult(results);
            for (const key of keys) {
                yield key;
            }
        }
    }

    /**
     * Iterate over map's values
     * 
     * @returns 
     */
    public async * values(): AsyncIterableIterator<V> {
        for await (const [, val] of this) {
            yield val;
        }
    }
}