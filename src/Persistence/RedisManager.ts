import { Connection } from "../Connection/Connection";
import { getRedisHashProperties, isRedisHash } from "../Metadata/Metadata";
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
        this.operator = new Operator();
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
        const allEntities = this.getEntitiesForSubscribers(entity);

        // Call entities subscribers
        allEntities.reduceRight((prev, current) => {
            const subscriber = this.subscribers.find(subscriber => subscriber.listenTo() === current.constructor);
            if (subscriber && subscriber.beforeSave) {
                subscriber.beforeSave(current);
            }
            return prev;
        }, {});
        // Do operation
        await this.connection.transaction(executor => {
            for (const deleteSet of operation.deletesSets) {
                executor.del(deleteSet);
            }
            for (const deleteHash of operation.deleteHashes) {
                executor.del(deleteHash);
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
        // update metadata
        this.operator.updateMetadataInHash(entity);
        // Call entities subscribers
        allEntities.reduceRight((prev, current) => {
            const subscriber = this.subscribers.find(subscriber => subscriber.listenTo() === current.constructor);
            if (subscriber && subscriber.afterSave) {
                subscriber.afterSave(current);
            }
            return prev;
        }, {});
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


    /**
     * Return all entities including relating intities when cascading is needed
     * 
     * @private
     * @param entity 
     * @param [entities=[]] 
     * @returns 
     */
    private getEntitiesForSubscribers(entity: { [key: string]: any }, entities: object[] = []): object[] {
        if (!isRedisHash(entity) || entities.includes(entities)) {
            return entities;
        }
        entities.push(entity);
        const metadata = getRedisHashProperties(entity); 
        if (!metadata) {
            return entities;
        }
        for (const propMetadata of metadata) {
            // no need to process non relations or without cascading options
            if (!propMetadata.isRelation || !(propMetadata.relationOptions.cascadeInsert || propMetadata.relationOptions.cascadeUpdate)) {
                continue;
            }
            const propValue = entity[propMetadata.propertyName];
            if (!propValue) {
                continue;
            }
            if (propValue instanceof Map || propValue instanceof Set) {
                for (const collVal of propValue.values()) {
                    this.getEntitiesForSubscribers(collVal, entities);
                }
            } else {
                this.getEntitiesForSubscribers(propValue, entities);
            }
        }
        return entities;
    }
}