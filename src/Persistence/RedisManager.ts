import { Connection } from "../Connection/Connection";
import { getEntityFullId, getEntityProperties, isRedisEntity } from "../Metadata/Metadata";
import { EntitySubscriberInterface } from "../Subscriber/EntitySubscriberInterface";
import { HydrationData, LoadOperation, Operator, PersistenceOperation } from "./Operator";

export type EntityType<T> = { new(): T } | Function;

/**
 * Main manager to get/save/remove entities
 * 
 * @export
 * @class RedisManager
 */
export class RedisManager {
    /**
     * Connection instance
     * 
     * @protected
     */
    public connection: Connection;

    /**
     * Array of entity subscribers
     * 
     * @protected
     */
    protected subscribers: Array<EntitySubscriberInterface<any>> = [];

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
     * @param entityClass 
     * @param id 
     * @param [skipRelations] 
     * @returns 
     */
    public async load<T>(entityClass: EntityType<T>, id: string | number, skipRelations?: Array<keyof T>): Promise<T | undefined>;
    /**
     * Get entities
     * 
     * @template T 
     * @param entityClass 
     * @param id 
     * @param [skipRelations] 
     * @returns 
     */
    public async load<T>(entityClass: EntityType<T>, id: string[] | number[], skipRelations?: Array<keyof T>): Promise<T[] | undefined>;
    public async load<T>(entityClass: EntityType<T>, id: string | string[] | number | number[], skipRelations?: Array<keyof T>): Promise<T | undefined | T[]> {
        const idsToLoad = Array.isArray(id) ? id : [id];

        const entityIdToClassMap: Map<string, EntityType<any>> = new Map();
        const loadedData: Map<string, HydrationData> = new Map();
        const rootLoadOperations = idsToLoad.map(id => this.operator.getLoadOperation(id, entityClass, skipRelations)).filter(op => !!op) as LoadOperation[];

        rootLoadOperations.forEach(op => entityIdToClassMap.set(op.entityId, entityClass));

        const recursiveLoadDataWithRelations = async (operations: LoadOperation[]) => {
            const loadedDataForCall: HydrationData[] = [];

            // easier to use callbacks instead of processing result
            await this.connection.batch(executor => {
                for (const op of operations) {
                    executor.hgetall(op.entityId, (err, result) =>
                        loadedDataForCall.push({ id: op.entityId, redisData: result, entityClass: entityIdToClassMap.get(op.entityId) }));
                    for (const hash of op.hashes) {
                        executor.hgetall(hash, (err, result) => loadedDataForCall.push({ id: hash, redisData: result }));
                    }
                    for (const set of op.sets) {
                        executor.smembers(set, (err, result) => loadedDataForCall.push({ id: set, redisData: result }));
                    }
                }
            });
            loadedDataForCall.forEach(data => loadedData.set(data.id, data));
            const allMappings: LoadOperation["relationMappings"] = [];
            for (const op of operations) {
                allMappings.push(...op.relationMappings);
            }

            const relationOperations: Array<LoadOperation | undefined> = [];
            for (const mapping of allMappings) {
                const relationClass = mapping.relationClass;
                switch (mapping.type) {
                    // single relation in key
                    case "key": {
                        const hashVal = loadedDataForCall.find(data => data.id === mapping.ownerId);
                        if (hashVal && hashVal.redisData && !Array.isArray(hashVal.redisData) && hashVal.redisData[mapping.id]) {
                            const relationVal = hashVal.redisData[mapping.id];
                            if (relationVal && !loadedData.has(relationVal)) {
                                entityIdToClassMap.set(relationVal, relationClass);
                                relationOperations.push(this.operator.getLoadOperation(relationVal, relationClass));
                            }
                        }
                        break;
                    }
                    // set of relations
                    case "set": {
                        const set = loadedDataForCall.find(data => data.id === mapping.id);
                        if (set && set.redisData && Array.isArray(set.redisData)) {
                            for (const setVal of set.redisData) {
                                if (!loadedData.has(setVal)) {
                                    entityIdToClassMap.set(setVal, relationClass);
                                    relationOperations.push(this.operator.getLoadOperation(setVal, relationClass));
                                }
                            }
                        }
                        break;
                    }
                    // map of relations
                    case "map": {
                        const map = loadedDataForCall.find(data => data.id === mapping.id);
                        if (map && map.redisData && !Array.isArray(map.redisData) && Object.keys(map.redisData).length > 0) {
                            for (const key of Object.keys(map.redisData)) {
                                const relVal = map.redisData[key];
                                if (!loadedData.has(relVal)) {
                                    entityIdToClassMap.set(relVal, relationClass);
                                    relationOperations.push(this.operator.getLoadOperation(relVal, relationClass));
                                }
                            }
                        }
                        break;
                    }    
                }
            }
            if (relationOperations.length > 0) {
                await recursiveLoadDataWithRelations(relationOperations.filter(op => !!op) as LoadOperation[]);
            }
        };
        await recursiveLoadDataWithRelations(rootLoadOperations);
        const hydratedData = this.operator.hydrateData(loadedData);
        // run subscribers in reverse order
        hydratedData.reduceRight((unusued, data) => {
            if (data && data.constructor) {
                const subscriber = this.subscribers.find(sub => sub.listenTo() === data.constructor);
                if (subscriber && subscriber.afterLoad) {
                    subscriber.afterLoad(data);
                }
            }
        }, {});

        return Array.isArray(id)
            ? hydratedData.filter(data => data && data.constructor === entityClass)
            : hydratedData.find(data => data && data.constructor === entityClass);
    }

    /**
     * Remove entity. Doesn't remove linked relations
     * 
     * @param entity 
     * @returns 
     */
    public async remove(entity: object): Promise<void> { 
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
        this.operator.resetMetadataInEntityObject(entity);
        if (subscriber && subscriber.afterRemove) {
            subscriber.afterRemove(entity);
        }
    }

    /**
     * Serialize simple value to store it in redis
     * 
     * @param value 
     * @returns 
     */
    public serializeSimpleValue(value: any): string | undefined {
        return this.operator.serializeValue(value);
    }

    /**
     * Unserialize value
     * 
     * @param value 
     * @returns 
     */
    public unserializeSimpleValue(value: string): any {
        return this.operator.unserializeValue(value);
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
        if (!isRedisEntity(entity) || entities.includes(entity)) {
            return entities;
        }
        entities.push(entity);
        const metadata = getEntityProperties(entity); 
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
            const hashId = getEntityFullId(entity);
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