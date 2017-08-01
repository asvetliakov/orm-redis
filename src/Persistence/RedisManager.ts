import { LazyMap } from "../Collections/LazyMap";
import { LazySet } from "../Collections/LazySet";
import { RedisLazyMap } from "../Collections/RedisLazyMap";
import { RedisLazySet } from "../Collections/RedisLazySet";
import { Connection } from "../Connection/Connection";
import { MetadataError } from "../Errors/Errors";
import { getEntityFullId, getEntityProperties, getRelationType, isRedisEntity } from "../Metadata/Metadata";
import { EntitySubscriberInterface } from "../Subscriber/EntitySubscriberInterface";
import { hasPrototypeOf } from "../utils/hasPrototypeOf";
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
     */
    public constructor(connection: Connection) {
        this.connection = connection;
        this.operator = new Operator();
    }

    /**
     * Assign entity subscribers
     * 
     * @param subscribers 
     */
    public assignSubscribers(subscribers: Array<EntitySubscriberInterface<any>>) {
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
        // Run beforeSave subscribers for all entities regardless will they be finally saved or no
        // started from most deep relation entity to root entity
        const allEntities = this.getEntitiesForSubscribers(entity).reverse();
        for (const ent of allEntities) {
            const subscriber = this.subscribers.find(subscriber => subscriber.listenTo() === ent.constructor);
            if (subscriber && subscriber.beforeSave) {
                subscriber.beforeSave(ent);
            }
        }

        const operation = await this.operator.getSaveOperation(entity);
        if (this.isEmptyPersistenceOperation(operation)) {
            return;
        }

        // Call entities subscribers
        // Do operation
        await this.connection.batch(executor => {
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
        this.initLazyCollections(entity);
        // Call entities subscribers
        for (const ent of this.filterEntitiesForPersistenceOperation(allEntities, operation)) {
            const subscriber = this.subscribers.find(subscriber => subscriber.listenTo() === ent.constructor);
            if (subscriber && subscriber.afterSave) {
                subscriber.afterSave(ent);
            }
        }
    }

    /**
     * Check if there is a given entity with given id
     * 
     * @param entityClass 
     * @param id 
     * @returns 
     */
    public async has(entityClass: EntityType<any>, id: string | number): Promise<boolean> {
        const fullId = getEntityFullId(entityClass, id);
        if (!fullId) {
            throw new MetadataError(entityClass, "Unable to get entity id");
        }
        const exists = await this.connection.client.existsAsync(fullId);
        return exists === 1 ? true : false;
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
        // Init lazy collections
        hydratedData.forEach(data => {
            if (data && data.constructor && isRedisEntity(data)) {
                this.initLazyCollections(data);
            }
        });
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
        await this.connection.batch(executor => {
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
     * Remove entity be it's id. This WON'T trigger entity subscribers beforeRemove/afterRemove
     * 
     * @param entityClass 
     * @param id 
     * @returns 
     */
    public async removeById(entityClass: EntityType<any>, id: string | number | string[] | number[]): Promise<void> {
        const idsToRemove = Array.isArray(id) ? id : [id];
        const operations = idsToRemove.map(id => this.operator.getDeleteOperation(entityClass, id));
        if (operations.every(this.isEmptyPersistenceOperation)) {
            return;
        }
        await this.connection.batch(executor => {
            for (const operation of operations) {
                for (const deleteSet of operation.deletesSets) {
                    executor.del(deleteSet);
                }
                for (const deleteHash of operation.deleteHashes) {
                    executor.del(deleteHash);
                }
            }
        });
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
     * Init lazy set and maps. This will replace LazySet/LazyMap instances with redis-backed analogs
     * 
     * @param entity 
     */
    public initLazyCollections(entity: { [key: string]: any }): void {
        const id = getEntityFullId(entity);
        if (!id) {
            throw new MetadataError(entity.constructor, "Unable to get entity id");
        }
        const properties = getEntityProperties(entity);
        if (!properties) {
            throw new MetadataError(entity.constructor, "No any properties");
        }
        for (const prop of properties) {
            if (hasPrototypeOf(prop.propertyType, LazyMap) && !(entity[prop.propertyName] instanceof RedisLazyMap)) {
                const mapId = this.operator.getCollectionId(id, prop);
                if (mapId) {
                    entity[prop.propertyName] = new RedisLazyMap(
                        mapId,
                        this,
                        prop.isRelation
                            ? getRelationType(entity, prop)
                            : undefined,
                        prop.isRelation
                            ? prop.relationOptions.cascadeInsert
                            : false
                    );
                }
            } else if (hasPrototypeOf(prop.propertyType, LazySet) && !(entity[prop.propertyName] instanceof RedisLazySet)) {
                const setId = this.operator.getCollectionId(id, prop);
                if (setId) {
                    entity[prop.propertyName] = new RedisLazySet(
                        setId,
                        this,
                        prop.isRelation
                            ? getRelationType(entity, prop)
                            : undefined,
                        prop.isRelation
                            ? prop.relationOptions.cascadeInsert
                            : false
                    );
                }
            }
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