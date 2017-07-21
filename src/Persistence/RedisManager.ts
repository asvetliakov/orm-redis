import { Connection } from "../Connection/Connection";
import { EntitySubscriberInterface } from "../Subscriber/EntitySubscriberInterface";
import { Operator } from "./Operator";

export class RedisManager {
    /**
     * Array of entity subscribers
     * 
     * @protected
     */
    protected subscribers: Array<EntitySubscriberInterface<any>> = [];
    
    /**
     * Connection instance
     * 
     * @protected
     */
    protected connection: Connection;

    /**
     * Entity operator
     * 
     * @protected
     */
    protected operator: Operator;

    /**
     * Creates an instance of RedisManager.
     * @param connection 
     * @param subscribers 
     */
    public constructor(connection: Connection, subscribers: Array<EntitySubscriberInterface<any>>) {
        this.connection = connection;
        this.subscribers = subscribers;
    }
    
    /**
     * Save entity
     * 
     * @template T 
     * @param entity 
     * @returns 
     */
    public async save<T extends object>(entity: T): Promise<void> {
        const operation = this.operator.getSaveOperation(entity);
        const subscriber = this.subscribers.find(subscriber => subscriber.listenTo() === entity.constructor);
        if (subscriber && subscriber.beforeSave) {
            subscriber.beforeSave(entity);
        }
        // Do operation
        await this.connection.transaction(executor => {
            for (const deleteSet of operation.deletesSets) {
                executor.del(deleteSet);
            }
            for (const deleteHash of operation.deleteHashes) {
                executor.debug(deleteHash);
            }
            for (const modifySet of operation.modifySets) {
                if (modifySet.removeValues.length > 0) {
                    executor.srem(modifySet.setName, modifySet.removeValues);
                }
                if (modifySet.addValues.length > 0) {
                    executor.sadd(modifySet.setName, modifySet.addValues);
                }
            }
            for (const modifyHash of operation.modifyHashes) {
                if (modifyHash.deleteKeys.length > 0) {
                    executor.hdel(modifyHash.hashId, modifyHash.deleteKeys);
                }
                if (Object.keys(modifyHash.changeKeys).length > 0) {
                    executor.hmset(modifyHash.hashId, modifyHash.changeKeys);
                }
            }
        });
        // Update/set metadata
        this.operator.updateMetadataInHash(entity);
        if (subscriber && subscriber.afterSave) {
            subscriber.afterSave(entity);
        }
    }

    
    /**
     * Get entity
     * 
     * @template T 
     * @param entity 
     * @param id 
     * @param [relations] 
     * @returns 
     */
    public async get<T>(entity: T, id: string, relations?: keyof T): Promise<T | undefined>;
    public async get<T>(entity: T, id: string[], relation?: keyof T): Promise<T[] | undefined>;
    public async get<T>(entity: T, id: string | string[], relations?: keyof T): Promise<T | T[] | undefined> {
        return Promise.resolve(undefined);
    }

    public async remove<T>(entity: T): Promise<void> { 

    }
}