import { LazyMap } from "../Collections/LazyMap";
import { LazySet } from "../Collections/LazySet";
import { RedisLazyMap } from "../Collections/RedisLazyMap";
import { RedisLazySet } from "../Collections/RedisLazySet";
import { DuplicateIdsInEntityError, MetadataError } from "../Errors/Errors";
import { getEntityFullId, getEntityProperties, PropertyMetadata, REDIS_COLLECTION_VALUE, REDIS_ENTITY, REDIS_PROPERTIES, REDIS_VALUE, RelationPropertyMetadata } from "../Metadata/Metadata";
import { hasPrototypeOf } from "../utils/hasPrototypeOf";
/**
 * Hash key add/remove operation. This applies for creating new hash and for modifying existing hash
 * 
 * @export
 * @interface HashPersistenceOperator
 */
export interface HashPersistenceOperator {
    /**
     * Hash id
     */
    hashId: string;
    /**
     * Keys to change/add. Existing keys will be owerwritten, news keys added
     */
    changeKeys: {
        [key: string]: string
    };
    /**
     * Array of keys to delete in hash
     */
    deleteKeys: string[];
}

/**
 * Set add/remove operation. This applies for new sets and existings sets
 * 
 * @export
 * @interface SetPersistenceOperator
 */
export interface SetPersistenceOperator {
    /**
     * Set id
     */
    setName: string;
    /**
     * Values in set to remove
     */
    removeValues: string[];
    /**
     * Values in set to add
     */
    addValues: string[];

}

/**
 * Persistence operation for given entity and it's relations
 * 
 * @export
 * @interface PersistenceOperation
 */
export interface PersistenceOperation {
    /**
     * Array of hashes to create/modify
     */
    modifyHashes: HashPersistenceOperator[];
    /**
     * Array of hash ids to delete
     */
    deleteHashes: string[];

    /**
     * Array of sets to create/modify
     */
    modifySets: SetPersistenceOperator[];
    /**
     * Array of sets to delete
     */
    deletesSets: string[];
}

export interface LoadOperation {
    /**
     * Full entity id to load
     */
    entityId: string;
    /**
     * Additional Sets to load
     */
    sets: string[];
    /**
     * Additional Hashes to load
     */
    hashes: string[];
    /**
     * Relation mapping
     */
    relationMappings: Array<{
        /**
         * Owner hash id
         */
        ownerId: string;
        /**
         * Relation class
         */
        relationClass: Function;
        /**
         * Mapping type for relation value
         */
        type: "key" | "map" | "set";
        /**
         * Mapping id. for key it's the hash key, for map/sets it's the map/set full id
         */
        id: string;
    }>;
}

export interface HydrationData {
    // Hash/Set id
    id: string;
    /**
     * Class constructor if the data is entity properties
     */
    entityClass?: Function;
    /**
     * Raw data
     */
    redisData: { [key: string]: string } | string[] | null;
}

export interface EntityWithId {
    entityId: string;
    entity: object;
}

/**
 * Object Operator
 * 
 * @export
 * @class Operator
 */
export class Operator {
    /**
     * Prepare to save/update entity and get necessary operations
     * 
     * @param entity 
     * @returns 
     */
    public async getSaveOperation(entity: { [key: string]: any }, processedEntities: EntityWithId[] = []): Promise<PersistenceOperation> {
        this.checkMetadata(entity);
        const metadatas: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, entity.constructor);
        const fullHashId = this.getFullIdForEntityObject(entity);


        const operation: PersistenceOperation = {
            deleteHashes: [],
            deletesSets: [],
            modifyHashes: [],
            modifySets: []
        };

        // Circular objects checking
        // Must check for circular references and prevent cascade delete/insert/update
        // Must check relation id and object equality to prevent different objects to be saved with same id
        const processedThisEntity = processedEntities.find(ent => ent.entityId === fullHashId);
        if (processedThisEntity) {
            if (processedThisEntity.entity !== entity) {
                // we have proceed entity with same id but objects are differs. This is error 
                throw new DuplicateIdsInEntityError(entity, fullHashId);
            } else {
                // Return empty operation since we already proceed it
                return operation;
            }
        }

        processedEntities.push({ entity: entity, entityId: fullHashId });

        const hashPropOperation: HashPersistenceOperator = {
            hashId: fullHashId,
            // hashName: hashName,
            changeKeys: {},
            deleteKeys: []
        };
        operation.modifyHashes.push(hashPropOperation);

        for (const propMetadata of metadatas) {
            // Get initial redis value. Will be undefined if it's new entity. May contain "null" as string
            const initialPropertyRedisValue: string | undefined | "null" = Reflect.getMetadata(REDIS_VALUE, entity, propMetadata.propertyName);
            const value = entity[propMetadata.propertyName];
            const valueType = propMetadata.propertyType;
            // special case for Map/Set
            if (hasPrototypeOf(valueType, Set) || hasPrototypeOf(valueType, Map) ||
                hasPrototypeOf(valueType, LazySet) || hasPrototypeOf(valueType, LazyMap)
            ) {
                const redisInitialCollectionValue: undefined | string[] | { [key: string]: string } = Reflect.getMetadata(REDIS_COLLECTION_VALUE, entity, propMetadata.propertyName);
                // LazyMaps and LazySets are not instances of Set/Maps so they won't be deleted
                const deleted = !value || ((value instanceof Set || value instanceof Map) && value.size === 0);
                const collectionId = this.getCollectionId(fullHashId, propMetadata)!;
                if (deleted) {
                    // Deleted or wasn't set
                    // 1. had val -> null. Delete map/set and set prop to "null"
                    // 2. had val -> undefined. Delete map/set and delete prop
                    // 3. had null -> null. Nop
                    // 4. had null -> undefined. Delete prop
                    // 5. had undefined -> undefined. Nop
                    // 6. had undefined -> null. Add "null" prop
                    // 7. had val -> become empty set or map
                    if (initialPropertyRedisValue && initialPropertyRedisValue !== "null" && redisInitialCollectionValue) {
                        // 1, 2, 7
                        if (hasPrototypeOf(valueType, Set)) {
                            operation.deletesSets.push(collectionId);
                        } else if (hasPrototypeOf(valueType, Map)) {
                            operation.deleteHashes.push(collectionId);
                        }
                        value === null
                            ? hashPropOperation.changeKeys[propMetadata.propertyRedisName] = this.serializeValue(null)!
                            : hashPropOperation.deleteKeys.push(propMetadata.propertyRedisName);

                    } else if (initialPropertyRedisValue === "null") {
                        // 3, 4
                        if (typeof value === "undefined") {
                            // 4
                            hashPropOperation.deleteKeys.push(propMetadata.propertyRedisName);
                        }
                    } else if (!initialPropertyRedisValue) {
                        // 5, 6
                        if (value === null) {
                            // 6
                            hashPropOperation.changeKeys[propMetadata.propertyRedisName] = this.serializeValue(null)!;
                        }
                    }
                    // 
                } else if ((value instanceof Set || value instanceof Map) && value.size > 0) {
                    // deleted keys
                    const deleted: Set<string> = new Set();
                    // For non relations sets key and value will be same
                    const added: Map<string, any> = new Map();
                    const changed: Map<string, any> = new Map();
                    if (propMetadata.isRelation && (propMetadata.relationOptions.cascadeInsert || propMetadata.relationOptions.cascadeUpdate)) {
                        this.ensureValidRelations([...value.values()], entity);
                    }

                    // calculate key/values differences
                    if (value instanceof Set) {
                        // convert value set to map of values/entity names -> entity if needed, since original redis collection will only have them
                        const preparedValueMap = new Map<string, any>();
                        for (const val of value.values()) {
                            if (propMetadata.isRelation) {
                                const relationId = this.prepareRelationValue(val, propMetadata)!;
                                preparedValueMap.set(relationId, val);
                            } else {
                                const preparedVal = this.serializeValue(val);
                                if (preparedVal) {
                                    preparedValueMap.set(preparedVal, preparedVal);
                                }
                            }
                        }
                        // Calculate added/changed values over original collection. cascadeUpdate for relations will always mark collection as changed
                        if (redisInitialCollectionValue && Array.isArray(redisInitialCollectionValue)) {
                            for (const key of preparedValueMap.keys()) {
                                if (!redisInitialCollectionValue.includes(key)) {
                                    added.set(key, preparedValueMap.get(key));
                                } else if (propMetadata.isRelation && propMetadata.relationOptions.cascadeUpdate) {
                                    changed.set(key, preparedValueMap.get(key));
                                }
                            }
                            // calculate deleted values over original collection
                            for (const key of redisInitialCollectionValue) {
                                if (!preparedValueMap.has(key)) {
                                    deleted.add(key);
                                }
                            }
                        } else {
                            // new set
                            for (const key of preparedValueMap.keys()) {
                                added.set(key, preparedValueMap.get(key));
                            }
                        }
                    } else if (value instanceof Map) {
                        if (redisInitialCollectionValue && !Array.isArray(redisInitialCollectionValue)) {
                            // Calculate added/changed values over original collection. cascadeUpdate for relations will always mark collection as changed
                            for (const key of value.keys()) {
                                const preparedKey = this.serializeValue(key);
                                if (!preparedKey) {
                                    continue;
                                }
                                // added new key to map
                                if (typeof redisInitialCollectionValue[preparedKey] === "undefined") {
                                    added.set(preparedKey, value.get(key));
                                } else {
                                    const preparedValue = propMetadata.isRelation
                                        ? this.prepareRelationValue(value.get(key), propMetadata)
                                        : this.serializeValue(value.get(key));
                                    if ((redisInitialCollectionValue[preparedKey] !== preparedValue || // change value
                                        (propMetadata.isRelation && propMetadata.relationOptions.cascadeUpdate)) // cascade update will always force
                                    ) {
                                        changed.set(preparedKey, value.get(key));
                                    }
                                }
                            }
                            // key is preparedKey
                            for (const key of Object.keys(redisInitialCollectionValue)) {
                                const convertedKey = this.unserializeValue(key);
                                if (typeof convertedKey !== "undefined" && !value.has(convertedKey)) {
                                    deleted.add(key);
                                }
                            }
                        } else {
                            // new map
                            for (const key of value.keys()) {
                                const preparedKey = this.serializeValue(key);
                                if (typeof preparedKey === "undefined") {
                                    continue;
                                }
                                added.set(preparedKey, value.get(key));
                            }
                        }
                    }
                    if (initialPropertyRedisValue !== collectionId) {
                        // Add link to set/map
                        hashPropOperation.changeKeys[propMetadata.propertyRedisName] = collectionId;
                    }

                    // calculate differences from original collections
                    if (value instanceof Set) {
                        operation.modifySets.push({
                            setName: collectionId,
                            addValues: [...added.keys()],
                            removeValues: [...deleted.keys()]
                        });
                    } else if (value instanceof Map) {
                        operation.modifyHashes.push({
                            hashId: collectionId,
                            changeKeys: [...added.keys(), ...changed.keys()].reduce((obj: { [key: string]: string }, key) => {
                                const val = propMetadata.isRelation
                                    ? this.getFullIdForEntityObject(added.has(key) ? added.get(key) : changed.get(key))
                                    : this.serializeValue(added.has(key) ? added.get(key) : changed.get(key));
                                if (val) {
                                    obj[key] = val;
                                }
                                return obj;
                            }, {}),
                            deleteKeys: [...deleted.values()]
                        });
                    }
                    // Update/Insert relations if needed
                    if (propMetadata.isRelation && (propMetadata.relationOptions.cascadeInsert || propMetadata.relationOptions.cascadeUpdate)) {
                        const relationOperations = await Promise.all([
                            ...propMetadata.relationOptions.cascadeInsert ? added.values() : [],
                            ...propMetadata.relationOptions.cascadeUpdate ? changed.values() : []
                        ].map(entity => this.getSaveOperation(entity, processedEntities)));
                        for (const relOp of relationOperations) {
                            operation.deleteHashes.push(...relOp.deleteHashes);
                            operation.deletesSets.push(...relOp.deletesSets);
                            operation.modifyHashes.push(...relOp.modifyHashes);
                            operation.modifySets.push(...relOp.modifySets);
                        }
                    }
                } else if ((value instanceof LazyMap || value instanceof LazySet)
                    && !(value instanceof RedisLazyMap || value instanceof RedisLazySet) // don't process wrapped maps
                ) {
                    if (await value.size() > 0) {
                        const collArray = await value.toArray();
                        if (value instanceof LazySet) {
                            const serializedValues = collArray
                                .map(val => propMetadata.isRelation ? this.getFullIdForEntityObject(val) : this.serializeValue(val))
                                .filter(val => typeof val !== "undefined") as string[];
                            operation.modifySets.push({
                                setName: collectionId,
                                addValues: serializedValues,
                                removeValues: []
                            });
                        } else if (value instanceof LazyMap) {
                            const serializedParis = collArray
                                .map(pair => {
                                    const serializedKey = this.serializeValue(pair[0]);
                                    const serializedValue = propMetadata.isRelation ? this.getFullIdForEntityObject(pair[1]) : this.serializeValue(pair[1]);
                                    if (typeof serializedKey !== "undefined" && typeof serializedValue !== "undefined") {
                                        return [serializedKey, serializedValue];
                                    } else {
                                        return undefined;
                                    }
                                }).filter(pair => typeof pair !== "undefined") as Array<[string, any]>;
                            operation.modifyHashes.push({
                                hashId: collectionId,
                                deleteKeys: [],
                                changeKeys: serializedParis.reduce((obj, [key, val]) => {
                                    obj[key] = val;
                                    return obj;
                                }, {} as { [key: string]: string })
                            });
                        }
                        if (propMetadata.isRelation && propMetadata.relationOptions.cascadeInsert) {
                            const relationOperations = await Promise.all(collArray
                                .filter(val => Array.isArray(val) ? typeof val[1] !== "undefined" : typeof val !== "undefined")
                                .map(val => Array.isArray(val) ? this.getSaveOperation(val[1], processedEntities) : this.getSaveOperation(val, processedEntities)));
                            for (const relOp of relationOperations) {
                                operation.deleteHashes.push(...relOp.deleteHashes);
                                operation.deletesSets.push(...relOp.deletesSets);
                                operation.modifyHashes.push(...relOp.modifyHashes);
                                operation.modifySets.push(...relOp.modifySets);
                            }
                        }
                    }
                }
            } else {
                // Ordinary hash value or single relation
                const preparedValue = propMetadata.isRelation
                    ? this.prepareRelationValue(value, propMetadata)
                    : this.serializeValue(value);
                if (typeof preparedValue === "undefined" && initialPropertyRedisValue) {
                    // deletion
                    // delete hash key
                    hashPropOperation.deleteKeys.push(propMetadata.propertyRedisName);
                } else if (typeof preparedValue !== "undefined") {
                    // changed, addition

                    // Update hash key in original entity if needed
                    if (preparedValue !== initialPropertyRedisValue) {
                        hashPropOperation.changeKeys[propMetadata.propertyRedisName] = preparedValue;
                    }
                    if (propMetadata.isRelation) {
                        // Cases
                        // 1. had relation -> set null, cascade delete true -> delete relation
                        // 2. had relation -> set null, cascade delete false -> Nop
                        // 3. had relation -> change relation object to new id, cascade insert true -> add new relation
                        // 4. had relation -> change relation object to new id, cascade insert false -> Nop
                        // 5. had relation -> change relation object props, cascade update true -> save relation
                        // 6. had relation -> change relation object props, cascade update false -> Nop
                        // 7. didn't have relation -> add relation, cascade insert true -> add new relation
                        // 8. didn't have relation -> add relation, cascade insert false -> Nop
                        // 9. had relation -> change relation object to new id, cascade delete true -> delete previous relation

                        // 1, 2, 9 are invalid now

                        // if (preparedValue === "null" && preparedValue !== initialPropertyRedisValue && propMetadata.relationOptions.cascadeDelete) {
                        //     // Case 1
                        //     // Delete relation
                        //     const originalRelationValue: any = Reflect.getMetadata(REDIS_RELATION_VALUE, entity, propMetadata.propertyName);
                        //     if (originalRelationValue) {
                        //         const relationCascadeDeleteOp = this.getDeleteOperation(originalRelationValue, processedEntities);
                        //         operation.deleteHashes.push(...relationCascadeDeleteOp.deleteHashes);
                        //         operation.deletesSets.push(...relationCascadeDeleteOp.deletesSets);
                        //     } else if (initialPropertyRedisValue && initialPropertyRedisValue !== "null") {
                        //         operation.deleteHashes.push(initialPropertyRedisValue);
                        //     }
                        // } else
                        if (
                            (preparedValue !== initialPropertyRedisValue && propMetadata.relationOptions.cascadeInsert) || // case 3, 7, 9
                            (preparedValue === initialPropertyRedisValue && propMetadata.relationOptions.cascadeUpdate) // case 5
                        ) {
                            if (propMetadata.relationOptions.cascadeInsert || propMetadata.relationOptions.cascadeUpdate) {
                                const relationOperation = await this.getSaveOperation(value, processedEntities);
                                operation.deleteHashes.push(...relationOperation.deleteHashes);
                                operation.deletesSets.push(...relationOperation.deletesSets);
                                operation.modifyHashes.push(...relationOperation.modifyHashes);
                                operation.modifySets.push(...relationOperation.modifySets);
                            }
                            // case 9
                            // if (typeof initialPropertyRedisValue !== "undefined" &&
                            //     preparedValue !== initialPropertyRedisValue &&
                            //     initialPropertyRedisValue !== "null" &&
                            //     propMetadata.relationOptions.cascadeDelete
                            // ) {
                            //     const originalRelationValue: any = Reflect.getMetadata(REDIS_RELATION_VALUE, entity, propMetadata.propertyName);
                            //     if (originalRelationValue) {
                            //         const relationCascadeDeleteOp = this.getDeleteOperation(originalRelationValue, processedEntities);
                            //         operation.deleteHashes.push(...relationCascadeDeleteOp.deleteHashes);
                            //         operation.deletesSets.push(...relationCascadeDeleteOp.deletesSets);
                            //     } else {
                            //         operation.deleteHashes.push(initialPropertyRedisValue);
                            //     }
                            // }
                        }
                    }
                }
            }
        }
        return operation;
    }

    /**
     * Get delete operation for given loaded hash
     * 
     * @param entityOrEntityClass 
     * @param [entityId]
     * @returns 
     */
    public getDeleteOperation(entityOrEntityClass: { [key: string]: any } | Function, entityId?: string | number): PersistenceOperation {
        const operation: PersistenceOperation = {
            deleteHashes: [],
            deletesSets: [],
            modifyHashes: [],
            modifySets: []
        };
        if (!entityOrEntityClass) {
            return operation;
        }
        this.checkMetadata(entityOrEntityClass);
        const metadatas = getEntityProperties(entityOrEntityClass);
        if (!metadatas) {
            throw new MetadataError(typeof entityOrEntityClass === "function" ? entityOrEntityClass : entityOrEntityClass.constructor, "Not an entity");
        }
        // const fullHashId = this.getFullIdForEntityObject(entityOrEntityClass);
        const fullHashId = typeof entityId === "string" && entityId.startsWith("e:")
            ? entityId
            : getEntityFullId(entityOrEntityClass, entityId);   
        if (!fullHashId) {
            throw new MetadataError(typeof entityOrEntityClass === "function" ? entityOrEntityClass : entityOrEntityClass.constructor, "Unable to get id from entity");
        }


        // Circular objects checking
        // not needed since we won't cascade
        // Must check for circular references and prevent delete/insert/update
        // Must check relation id and object equality to prevent different objects to be saved with same id
        // const processedThisEntity = processedEntities.find(ent => ent.entityId === fullHashId);
        // if (processedThisEntity) {
        //     if (processedThisEntity.entity !== entity) {
        //         // we have proceed entity with same id but objects are differs. This is error 
        //         throw new DuplicateIdsInEntityError(entity, fullHashId);
        //     } else {
        //         // Return empty operation since we already proceed it
        //         return operation;
        //     }
        // }
        // processedEntities.push({ entity: entity, entityId: fullHashId });

        operation.deleteHashes.push(fullHashId);

        for (const propMetadata of metadatas) {
            const valueType = propMetadata.propertyType;
            // const initialRedisValue: string | undefined | "null" = Reflect.getMetadata(REDIS_VALUE, entityOrEntityClass, propMetadata.propertyName);

            // always try to delete maps/sets, there won't be error if there are not exist
            if (hasPrototypeOf(valueType, Set) || hasPrototypeOf(valueType, LazySet)) {
                // if (initialRedisValue && initialRedisValue !== "null") {
                operation.deletesSets.push(this.getCollectionId(fullHashId, propMetadata)!);
                // }
            } else if (hasPrototypeOf(valueType, Map) || hasPrototypeOf(valueType, LazyMap)) {
                // if (initialRedisValue && initialRedisValue !== "null") {
                operation.deleteHashes.push(this.getCollectionId(fullHashId, propMetadata)!);
                // }
            }
            // else if (propMetadata.isRelation && propMetadata.relationOptions.cascadeDelete && value) {
            //     const relationOperation = this.getDeleteOperation(value, processedEntities);
            //     operation.deleteHashes.push(...relationOperation.deleteHashes);
            //     operation.deletesSets.push(...relationOperation.deletesSets);
            // }
        }
        return operation;
    }

    /**
     * Get load operation for given hash class with given id
     * 
     * @param id 
     * @param hashClass 
     * @param skipRelations
     * @returns 
     */
    public getLoadOperation(id: string | number, hashClass: Function, skipRelations: string[] = []): LoadOperation | undefined {
        this.checkMetadata(hashClass);
        const fullHashId = typeof id === "string" && id.startsWith("e:") ? id : this.getFullIdForEntityClass(hashClass, id);

        const operation: LoadOperation = {
            entityId: fullHashId,
            hashes: [],
            sets: [],
            relationMappings: []
        };
        if (id === "null") {
            return undefined;
        }

        // operation.hashes.push(fullHashId);
        const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, hashClass);
        for (const propMetadata of metadata) {
            const propType = propMetadata.propertyType;
            if (hasPrototypeOf(propType, Set)) {
                const collId = this.getCollectionId(fullHashId, propMetadata)!;
                if (propMetadata.isRelation) {
                    if (!skipRelations.includes(propMetadata.propertyName)) {
                        operation.relationMappings.push({
                            ownerId: fullHashId,
                            relationClass: propMetadata.relationType,
                            id: collId,
                            type: "set"
                        });
                        operation.sets.push(collId);
                    }
                } else {
                    operation.sets.push(collId);
                }
            } else if (hasPrototypeOf(propType, Map)) {
                const collId = this.getCollectionId(fullHashId, propMetadata)!;
                if (propMetadata.isRelation) {
                    if (!skipRelations.includes(propMetadata.propertyName)) {
                        operation.relationMappings.push({
                            ownerId: fullHashId,
                            relationClass: propMetadata.relationType,
                            id: collId,
                            type: "map"
                        });
                        operation.hashes.push(collId);
                    }
                } else {
                    operation.hashes.push(collId);
                }
            } else if (!hasPrototypeOf(propType, LazySet) && !hasPrototypeOf(propType, LazyMap)) {
                if (propMetadata.isRelation && !skipRelations.includes(propMetadata.propertyName)) {
                    operation.relationMappings.push({
                        ownerId: fullHashId,
                        relationClass: propMetadata.relationType,
                        id: propMetadata.propertyRedisName,
                        type: "key"
                    });
                }
            }
        }
        return operation;
    }

    /**
     * Recursively process hash and set/update metadata
     * 
     * @param hashObject 
     * @param processedHashes
     */
    public updateMetadataInHash(hashObject: { [key: string]: any }, processedHashes: object[] = []): void {
        this.checkMetadata(hashObject);

        if (processedHashes.includes(hashObject)) {
            return;
        }
        processedHashes.push(hashObject);
        const fullHashId = this.getFullIdForEntityObject(hashObject);

        const metadatas: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, hashObject.constructor);
        for (const propMetadata of metadatas) {
            if (hasPrototypeOf(propMetadata.propertyType, Set) || hasPrototypeOf(propMetadata.propertyType, Map) ||
                hasPrototypeOf(propMetadata.propertyType, LazySet) || hasPrototypeOf(propMetadata.propertyType, LazyMap)
            ) {
                const collection = hashObject[propMetadata.propertyName] as Map<any, any> | Set<any> | null | undefined;
                if (collection === null) {
                    // Null value for collection
                    Reflect.defineMetadata(REDIS_VALUE, this.serializeValue(null)!, hashObject, propMetadata.propertyName);
                } else if (collection instanceof LazyMap || collection instanceof LazySet) {
                    // LazySets/Maps don't have REDIS_COLLECTION_VALUE since we don't need to get coll differences for them
                    const collectionId = this.getCollectionId(fullHashId, propMetadata);
                    Reflect.defineMetadata(REDIS_VALUE, collectionId, hashObject, propMetadata.propertyName);
                } else if ((collection instanceof Set || collection instanceof Map) && collection.size > 0) {
                    // Collection have both REDIS_VALUE and REDIS_COLLECTION_VALUE
                    const collectionValueForProp = this.getCollectionId(fullHashId, propMetadata);
                    if (collection instanceof Set) {
                        Reflect.defineMetadata(REDIS_VALUE, collectionValueForProp, hashObject, propMetadata.propertyName);
                        const setValues = [...collection.values()].map(
                            val => propMetadata.isRelation
                                ? this.prepareRelationValue(val, propMetadata)
                                : this.serializeValue(val)
                        ).filter(val => typeof val !== "undefined");
                        Reflect.defineMetadata(REDIS_COLLECTION_VALUE, setValues, hashObject, propMetadata.propertyName);
                    } else {
                        Reflect.defineMetadata(REDIS_VALUE, collectionValueForProp, hashObject, propMetadata.propertyName);
                        const mapValues: { [key: string]: string } = {};
                        for (const [key, val] of collection) {
                            const preparedKey = this.serializeValue(key);
                            const preparedVal = propMetadata.isRelation
                                ? this.prepareRelationValue(val, propMetadata)
                                : this.serializeValue(val);
                            if (typeof preparedKey !== "undefined" && typeof preparedVal !== "undefined") {
                                mapValues[preparedKey] = preparedVal;
                            }
                        }
                        Reflect.defineMetadata(REDIS_COLLECTION_VALUE, mapValues, hashObject, propMetadata.propertyName);
                    }
                    // Set metadata in relation hashes if cascase insert/update
                    if (propMetadata.isRelation && (propMetadata.relationOptions.cascadeInsert || propMetadata.relationOptions.cascadeUpdate)) {
                        for (const val of collection.values()) {
                            this.updateMetadataInHash(val, processedHashes);
                        }
                    }
                } else {
                    // Delete metadata
                    Reflect.defineMetadata(REDIS_VALUE, undefined, hashObject, propMetadata.propertyName);
                    Reflect.defineMetadata(REDIS_COLLECTION_VALUE, undefined, hashObject, propMetadata.propertyName);
                }
            } else {
                const value = hashObject[propMetadata.propertyName];
                const preparedValue = propMetadata.isRelation
                    ? this.prepareRelationValue(hashObject[propMetadata.propertyName], propMetadata)
                    : this.serializeValue(hashObject[propMetadata.propertyName]);
                if (typeof preparedValue !== "undefined") {
                    Reflect.defineMetadata(REDIS_VALUE, preparedValue, hashObject, propMetadata.propertyName);
                    // set metadata for relation
                    if (propMetadata.isRelation && (propMetadata.relationOptions.cascadeInsert || propMetadata.relationOptions.cascadeUpdate) && value) {
                        this.updateMetadataInHash(value, processedHashes);
                    }
                } else {
                    Reflect.defineMetadata(REDIS_VALUE, undefined, hashObject, propMetadata.propertyName);
                }
            }
        }
    }

    /**
     * Recursively process given hash and reset metadata
     * 
     * @param entityObj 
     */
    public resetMetadataInEntityObject(entityObj: { [key: string]: any }): void {
        this.checkMetadata(entityObj);
        const metadatas: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, entityObj.constructor);
        for (const propMetadata of metadatas) {
            // Since we don't support cascade delete no need to delete metadata in relations

            // Reflect.deleteMetadata doesn't work for some reason
            Reflect.defineMetadata(REDIS_VALUE, undefined, entityObj, propMetadata.propertyName);
            if (hasPrototypeOf(Set, propMetadata.propertyType) || hasPrototypeOf(Map, propMetadata.propertyType)) {
                Reflect.defineMetadata(REDIS_COLLECTION_VALUE, undefined, entityObj, propMetadata.propertyName);
            }
        }
    }

    /**
     * Hydrate redis data
     * 
     * @param hydrationData 
     * @returns 
     */
    public hydrateData(hydrationData: Map<string, HydrationData>): any[] {
        const processedData = new Map<string, any>();

        const processData = (data: HydrationData | undefined): void => {
            if (!data || processedData.has(data.id)) {
                return;
            }
            const { entityClass, id, redisData } = data;
            if (!redisData) {
                processedData.set(id, undefined);
                return;
            }
            const dataType = id.slice(0, 2);
            if (dataType === "e:" && !Array.isArray(redisData) && entityClass) {
                const entity = new (entityClass as any)();
                processedData.set(id, entity);
                const metadata = getEntityProperties(entityClass);
                if (metadata) {
                    for (const key of Object.keys(redisData)) {
                        const metadataForKey = metadata.find(m => m.propertyRedisName === key);
                        if (metadataForKey) {
                            const val = redisData[key];
                            const valType = val.slice(0, 2);
                            // define redis value metadata
                            Reflect.defineMetadata(REDIS_VALUE, val, entity, metadataForKey.propertyName);
                            let valueToSet: any;
                            if (valType === "e:") {
                                // single relation
                                // process relation if we didn't do it yet
                                if (!processedData.has(val)) {
                                    processData(hydrationData.get(val));
                                }
                                // set relation
                                valueToSet = processedData.get(val);
                            } else if (valType === "a:" || valType === "m:") {
                                // hash or sets
                                if (!processedData.has(val)) {
                                    processData(hydrationData.get(val));
                                }
                                valueToSet = processedData.get(val);
                                const collHydrationData = hydrationData.get(val);
                                if (collHydrationData) {
                                    Reflect.defineMetadata(REDIS_COLLECTION_VALUE, collHydrationData.redisData, entity, metadataForKey.propertyName);
                                }
                            } else {
                                valueToSet = this.unserializeValue(val);
                            }
                            if (typeof valueToSet !== "undefined") {
                                entity[metadataForKey.propertyName] = valueToSet;
                            }
                        }
                    }
                }

            } else if (dataType === "a:" && Array.isArray(redisData) && redisData.length > 0) {
                const set = new Set();
                processedData.set(id, set);
                for (const setData of redisData) {
                    const setDataType = setData.slice(0, 2);
                    
                    // Entity in set
                    if (setDataType === "e:") {
                        // check if we have already processed this entity, otherwise process it
                        if (!processedData.has(setData)) {
                            processData(hydrationData.get(setData));
                        }
                        // Will be processed at this time
                        set.add(processedData.get(setData));
                    } else {
                        set.add(this.unserializeValue(setData));
                    }
                }
            } else if (dataType === "m:" && !Array.isArray(redisData)) {
                const map = new Map();
                processedData.set(id, map);
                for (const key of Object.keys(redisData)) {
                    const dataVal = redisData[key];
                    const unserializedKey = this.unserializeValue(key);
                    const type = dataVal.slice(0, 2);
                    if (type === "e:") {
                        if (!processedData.has(dataVal)) {
                            processData(hydrationData.get(dataVal));
                        }
                        map.set(unserializedKey, processedData.get(dataVal));
                    } else {
                        map.set(unserializedKey, this.unserializeValue(dataVal));
                    }
                }
            } else {
                processedData.set(id, undefined);
            }
        };

        for (const data of hydrationData.values()) {
            processData(data);
        }


        return [...processedData.values()];
    }

    /**
     * Serialize value for persiting
     * 
     * @private
     * @param value 
     * @returns 
     */
    public serializeValue(value: any): string | undefined {
        if (typeof value === "number") {
            return `i:${value.toString()}`;
        } else if (typeof value === "string") {
            return `s:${value}`;
        } else if (typeof value === "boolean") {
            return value ? `b:1` : `b:0`;
        } else if (typeof value === "symbol" || typeof value === "function" || typeof value === "undefined") {
            return undefined;
        } else if (typeof value === "object") {
            if (value instanceof Date) {
                return `d:${value.getTime().toString()}`;
            } else if (value === null) {
                return "null";
            } else {
                return `j:${JSON.stringify(value)}`;
            }
        } else {
            return `j${JSON.stringify(value)}`;
        }
    }

    /**
     * Unserialize value
     * 
     * @private
     * @param value 
     * @returns 
     */
    public unserializeValue(value: string): string | number | boolean | null | object | Date | undefined {
        if (value === "null") {
            return null;
        }
        const type = value.slice(0, 2);
        const valWithoutType = value.slice(2);
        switch (type) {
            case "i:": return parseFloat(valWithoutType);
            case "s:": return valWithoutType;
            case "b:": return valWithoutType === "1" ? true : false;
            case "d:": return new Date(parseInt(valWithoutType));
            case "j:": return JSON.parse(valWithoutType);
            // return unserialized value for entities, sets and maps
            case "e:": return value;
            case "a:": return value;
            case "m:": return value;    
        }
        return undefined;
    }
    
    /**
     * Get id for collection for property
     * 
     * @param entityId 
     * @param propertyMetadata 
     * @returns 
     */
    public getCollectionId(entityId: string, propertyMetadata: PropertyMetadata): string | undefined {
        if (hasPrototypeOf(propertyMetadata.propertyType, Set) || hasPrototypeOf(propertyMetadata.propertyType, LazySet)) {
            return `a:${entityId}:${propertyMetadata.propertyRedisName}`;
        } else if (hasPrototypeOf(propertyMetadata.propertyType, Map) || hasPrototypeOf(propertyMetadata.propertyType, LazyMap)) {
            return `m:${entityId}:${propertyMetadata.propertyRedisName}`;
        } else {
            return undefined;
        }
    }


    /**
     * Check metadata correctness
     * 
     * @private
     * @param entity 
     */
    private checkMetadata(entity: object | Function): void {
        const entityType = typeof entity === "object" ? entity.constructor : entity;
        const hashName = Reflect.getMetadata(REDIS_ENTITY, entityType);
        if (!hashName) {
            throw new MetadataError(entityType, "Class must be decorated with @Entity decorator");
        }
        const metadatas: PropertyMetadata[] | undefined = Reflect.getMetadata(REDIS_PROPERTIES, entityType);
        if (!metadatas || metadatas.length === 0) {
            throw new MetadataError(entityType, "No any properties");
        }

        const idPropMetadata = metadatas.find(prop => !prop.isRelation && prop.isIdentifyColumn);
        if (!idPropMetadata) {
            throw new MetadataError(entityType, "Must contain one @IdentifyProperty decorator");
        }
    }

    /**
     * Get entity name
     * 
     * @private
     * @param entity 
     * @returns 
     */
    private getFullIdForEntityObject(entity: object): string {
        this.checkMetadata(entity);
        
        const hashId = getEntityFullId(entity);
        if (typeof hashId === "undefined") {
            throw new MetadataError(entity.constructor, "Unable to to get hash id");
        }
        return hashId;
    }


    /**
     * Get full id for given hash class and id
     * 
     * @private
     * @param entityClass 
     * @param id 
     * @returns 
     */
    private getFullIdForEntityClass(entityClass: Function, id: string | number): string {
        const hashId = getEntityFullId(entityClass, id);
        if (!hashId) {
            throw new MetadataError(entityClass, "Not a redis hash. Perhaps you forgot to add @Hash decorator");
        }
        return hashId;
    }

    /**
     * Make sure that relations are valid and doesn't have same ids but different object links
     * Same id and same object link (i.e rel === rel) is allowed
     * 
     * @private
     * @param relations 
     * @param parentEntity 
     */
    private ensureValidRelations(relations: object[], parentEntity: object): void {
        const processedRelations: { [key: string]: object } = {};
        for (const rel of relations) {
            const relFullId = this.getFullIdForEntityObject(rel);
            if (processedRelations[relFullId] && processedRelations[relFullId] !== rel) {
                throw new DuplicateIdsInEntityError(parentEntity, relFullId);
            }
            processedRelations[relFullId] = rel;
        }
    }


    /**
     * Prepare relation value persisting. This will be just entity name
     * 
     * @private
     * @param value 
     * @param metadata 
     * @returns 
     */
    private prepareRelationValue(value: any, metadata: RelationPropertyMetadata): string | undefined {
        this.checkMetadata(metadata.relationType);
        if (value) {
            return this.getFullIdForEntityObject(value);
        } else if (value === null) {
            return "null";
        } else {
            return undefined;
        }
    }
}