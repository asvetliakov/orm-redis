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
     * Relation class
     * 
     * @private
     */
    private entityClass?: Function;

    /**
     * Creates an instance of RedisLazySet.
     * @param setId Full set id in redis
     * @param manager Manager instance
     * @param [entityClass] If passed then set will be treated as entity set and will return entities
     */
    public constructor(setId: string, manager: RedisManager, entityClass?: EntityType<T>) {
        super();
        this.manager = manager;
        this.setId = setId;
        this.entityClass = entityClass;
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
            await this.manager.save(value as any);
            await this.manager.connection.client.saddAsync(this.setId, getEntityFullId(value)!);
        } else {
            const serializedVal = this.manager.serializeSimpleValue(value);
            if (serializedVal) {
                await this.manager.connection.client.saddAsync(this.setId, serializedVal);
            }
        }
    }

    /**
     * Remove value or entity from the set. If set is the relation set then it's automatically remove entity
     * 
     * @param value 
     * @returns 
     */
    public async delete(value: T): Promise<boolean> {
        let res: number;
        if (this.entityClass) {
            // Entity
            await this.manager.remove(value as any);
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