import { Connection } from "../Connection/Connection";
import { getRedisHashFullId, getRedisHashProperties, isRedisHash } from "../Metadata/Metadata";
import { EntitySubscriberInterface } from "../Subscriber/EntitySubscriberInterface";
import { Operator, PersistenceOperation } from "./Operator";

/**
 * Main manager to get/save/remove entities
 * 
 * @export
 * @class RedisManager
 */
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
        // Run beforeSave subscribers for all entities regardless will they be finally saved or no
        // started from most deep relation entity to root entity
        const allEntities = this.getEntitiesForSubscribers(entity).reverse();
        for (const ent of allEntities) {
            const subscriber = this.subscribers.find(subscriber => subscriber.listenTo() === ent.constructor);
            if (subscriber && subscriber.beforeSave) {
                subscriber.beforeSave(ent);
            }
        }

        const operation = this.operator.getSaveOperation(entity);
        if (this.isEmptyPersistenceOperation(operation)) {
            return;
        }

        // Call entities subscribers
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
        for (const ent of this.filterEntitiesForPersistenceOperation(allEntities, operation)) {
            const subscriber = this.subscribers.find(subscriber => subscriber.listenTo() === ent.constructor);
            if (subscriber && subscriber.afterSave) {
                subscriber.afterSave(ent);
            }
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

    /**
     * Remove entity. Doesn't remove linked relations
     * 
     * @template T 
     * @param entity 
     * @returns 
     */
    public async remove<T>(entity: T): Promise<void> { 
        const operation = this.operator.getDeleteOperation(entity);
        if (this.isEmptyPersistenceOperation(operation)) {
            return;
        }
        // Since we don't support cascade delete no need to process relations for subscribers
        const subscriber = this.subscribers.find(sub => sub.listenTo() === entity.constructor);
        if (subscriber && subscriber.beforeRemove) {
            subscriber.beforeRemove(entity);
        }
        await this.connection.transaction(executor => {
            for (const deleteSet of operation.deletesSets) {
                executor.del(deleteSet);
            }
            for (const deleteHash of operation.deleteHashes) {
                executor.del(deleteHash);
            }
        });
        this.operator.resetMetadataInHash(entity);
        if (subscriber && subscriber.afterRemove) {
            subscriber.afterRemove(entity);
        }
    }


    /**
     * Return all entities which should fire related subscribers for save/update/delete operation
     * 
     * @private
     * @param entity 
     * @param operation
     * @param [entities=[]] 
     * @returns 
     */
    private getEntitiesForSubscribers(entity: { [key: string]: any }, entities: object[] = []): object[] {
        if (!isRedisHash(entity) || entities.includes(entity)) {
            return entities;
        }
        entities.push(entity);
        const metadata = getRedisHashProperties(entity); 
        if (!metadata) {
            return entities;
        }
        // const redisHash = getRedisHashId(entity);
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

    /**
     * Return entities which were somehow changed with given operation
     * 
     * @private
     * @param entities 
     * @param operation 
     * @returns 
     */
    private filterEntitiesForPersistenceOperation(entities: object[], operation: PersistenceOperation): object[] {
        return entities.filter(entity => {
            const hashId = getRedisHashFullId(entity);
            if (!hashId) {
                return false;
            }
            if (operation.deleteHashes.find(name => name.includes(hashId))) {
                return true;
            }
            if (operation.deletesSets.find(name => name.includes(hashId))) {
                return true;
            }
            if (operation.modifyHashes.find(v => ((v.deleteKeys.length > 0 || Object.keys(v.changeKeys).length > 0) && v.hashId.includes(hashId)))) {
                return true;
            }
            if (operation.modifySets.find(v => ((v.addValues.length > 0 || v.removeValues.length > 0) && v.setName.includes(hashId)))) {
                return true;
            }
            return false;
        });
    }

    /**
     * True true if persistence operation is empty (i.e. doesn't have any changes)
     * 
     * @private
     * @param operation 
     * @returns 
     */
    private isEmptyPersistenceOperation(operation: PersistenceOperation): boolean {
        return operation.deleteHashes.length === 0 && operation.deletesSets.length === 0 &&
            (operation.modifyHashes.length === 0 || operation.modifyHashes.every(val => val.deleteKeys.length === 0 && Object.keys(val.changeKeys).length === 0)) &&
            (operation.modifySets.length === 0 || operation.modifySets.every(val => val.addValues.length === 0 && val.removeValues.length === 0));
    }
}