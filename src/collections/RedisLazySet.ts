import { getEntityFullId } from "../Metadata/Metadata";
import { EntityType, RedisManager } from "../Persistence/RedisManager";
import { LazySet } from "./LazySet";

/**
 * Redis-backed lazy set
 * 
 * @export
 * @class RedisLazySet
 * @template T 
 */
export class RedisLazySet<T> extends LazySet<T> {
    /**
     * Manager instance
     * 
     * @private
     */
    private manager: RedisManager;
    /**
     * Full set id
     * 
     * @private
     */
    private setId: string;

    /**
     * Entity class
     * 
     * @private
     */
    private entityClass?: Function;

    /**
     * Cascade insert related entities
     * 
     * @private
     */
    private cascadeInsert: boolean;

    /**
     * Creates an instance of RedisLazySet.
     * @param setId Full set id in redis
     * @param manager Manager instance
     * @param [entityClass] If passed then set will be treated as entity set and will return entities
     */
    public constructor(setId: string, manager: RedisManager, entityClass?: EntityType<T>, cascadeInsert: boolean = false) {
        super();
        this.manager = manager;
        this.setId = setId;
        this.entityClass = entityClass;
        this.cascadeInsert = cascadeInsert;
    }

    /**
     * Add value or entity to the set
     * 
     * @param value 
     * @returns 
     */
    public async add(value: T): Promise<void> {
        if (this.entityClass) {
            // Entity
            if (this.cascadeInsert) {
                await this.manager.save(value as any);
            }
            await this.manager.connection.client.saddAsync(this.setId, getEntityFullId(value)!);
        } else {
            const serializedVal = this.manager.serializeSimpleValue(value);
            if (serializedVal) {
                await this.manager.connection.client.saddAsync(this.setId, serializedVal);
            }
        }
    }

    /**
     * Remove value or entity from the set.
     * 
     * @param value 
     * @param [deleteEntity=false]
     * @returns 
     */
    public async delete(value: T, deleteEntity: boolean = false): Promise<boolean> {
        let res: number;
        if (this.entityClass) {
            // Entity
            if (deleteEntity) {
                await this.manager.remove(value as any);
            }
            res = await this.manager.connection.client.sremAsync(this.setId, getEntityFullId(value)!);
        } else {
            const serializedVal = this.manager.serializeSimpleValue(value);
            if (serializedVal) {
                res = await this.manager.connection.client.sremAsync(this.setId, serializedVal);
            } else {
                res = 0;
            }
        }
        return res > 0 ? true : false;
    }

    /**
     * Determine if value or entity exists in the set
     * 
     * @param value 
     * @returns 
     */
    public async has(value: T): Promise<boolean> {
        const id = this.entityClass ? getEntityFullId(value)! : this.manager.serializeSimpleValue(value);
        if (typeof id === "undefined") {
            return false;
        }
        const res =  await this.manager.connection.client.sismemberAsync(this.setId, id);
        return !!res;
    }

    /**
     * Get size of set
     * 
     * @returns 
     */
    public async size(): Promise<number> {
        return await this.manager.connection.client.scardAsync(this.setId);
    }

    /**
     * Clear set
     * 
     * @param [deleteEntities=false] Also delete all entities
     * @returns 
     */
    public async clear(deleteEntities: boolean = false): Promise<void> {
        if (this.entityClass && deleteEntities) {
            const setVals = await this.manager.connection.client.smembersAsync(this.setId);
            await this.manager.removeById(this.entityClass, setVals);
        }
        await this.manager.connection.client.delAsync(this.setId);
    }

    /**
     * Convert set to array
     * 
     * @returns 
     */
    public async toArray(): Promise<T[]> {
        const results: T[] = [];
        for await (const v of this.values()) {
            results.push(v);
        }
        return results;
    }

    /**
     * Iterate over values
     */
    public async * values(): AsyncIterableIterator<T> {
        let [cursor, results]: [string, any[]] = await this.manager.connection.client.sscanAsync(this.setId, "0");
        // load entities
        if (this.entityClass && results.length > 0) {
            results = await this.manager.load(this.entityClass, results) as any;
        } else {
            results = results.map(res => this.manager.unserializeSimpleValue(res));
        }
        for (const res of results) {
            yield res;
        }
        while (cursor !== "0") {
            [cursor, results] = await this.manager.connection.client.sscanAsync(this.setId, cursor);
            // load entities
            if (this.entityClass && results.length > 0) {
                results = await this.manager.load(this.entityClass, results) as any;
            } else {
                results = results.map(res => this.manager.unserializeSimpleValue(res));
            }
            for (const res of results) {
                yield res;
            }
        }
    }

    /**
     * Iterator over values
     * 
     * @returns 
     */
    public async * [Symbol.asyncIterator](): AsyncIterableIterator<T> {
        for await (const val of this.values()) {
            yield val;
        }
    }
}