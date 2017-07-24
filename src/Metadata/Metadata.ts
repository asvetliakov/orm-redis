/**
 * Metadata key to mark class to be stored as redis hash
 */
export const REDIS_ENTITY = Symbol("Redis Hash");

/**
 * Metadata key to store redis properties metadatas
 */
export const REDIS_PROPERTIES = Symbol("Redis properties");

/**
 * Metadata key to keep serialized initial value of property from redis. For collections this will be link to the corresponding hashmap/set
 */
export const REDIS_VALUE = Symbol("Redis initial value");

/**
 * Metadata key to keep the initial state of redis collections (map/set)
 */
export const REDIS_COLLECTION_VALUE = Symbol("Redis initial collection value");


export type PropertyMetadata = SimplePropertyMetadata | RelationPropertyMetadata;

/**
 * Hash simple property metadata
 * 
 * @export
 * @interface SimplePropertyMetadata
 */
export interface SimplePropertyMetadata {
    /**
     * Property name in class
     */
    propertyName: string;
    /**
     * Property name stored in redis
     */
    propertyRedisName: string;
    /**
     * Property type
     */
    propertyType: any;
    /**
     * True if property must be identify column
     */
    isIdentifyColumn: boolean;
    /**
     * Relation flag
     */
    isRelation: false;
}

/**
 * Relation options
 * 
 * @export
 * @interface RelationOptions
 */
export interface RelationOptions {
    /**
     * Property name in redis
     */
    propertyName?: string;
    /**
     * True to automatically create new hash for relation
     */
    cascadeInsert?: boolean;
    /**
     * True to automatically update corresponding relation hash
     */
    cascadeUpdate?: boolean;
}

/**
 * Hash relation property metadata
 * 
 * @export
 * @interface RelationPropertyMetadata
 */
export interface RelationPropertyMetadata {
    /**
     * Property name in class
     */
    propertyName: string;
    /**
     * Property name stored in redis
     */
    propertyRedisName: string;
    /**
     * Property type.
     * For set property relation it will be Set itself
     * For single property relation it will be equal to relationType
     */
    propertyType: any;
    /**
     * Relation flag
     */
    isRelation: true;
    /**
     * Relation type. Must be type of related entity
     */
    relationType: any;
    /**
     * Relation options
     */
    relationOptions: RelationOptions;
}

/**
 * Return true if given object is redis entity like
 * 
 * @export
 * @param entity 
 * @returns 
 */
export function isRedisEntity(entity: object): boolean {
    if (typeof entity !== "object" || entity === null) {
        return false;
    }
    const metadata = Reflect.getMetadata(REDIS_ENTITY, entity.constructor);
    return !!metadata;
}

/**
 * Return entity name
 * 
 * @export
 * @param entityOrEntityClass 
 * @returns 
 */
export function getEntityName(entityOrEntityClass: object | Function): string | undefined {
    const metadata = Reflect.getMetadata(REDIS_ENTITY, typeof entityOrEntityClass === "function" ? entityOrEntityClass : entityOrEntityClass.constructor);
    return metadata;
}

/**
 * Return entity id
 * 
 * @export
 * @param entity 
 * @returns 
 */
export function getEntityId(entity: { [key: string]: any }): string | number | undefined {
    if (!isRedisEntity(entity)) {
        return undefined;
    }
    const metadatas: PropertyMetadata[]  = Reflect.getMetadata(REDIS_PROPERTIES, entity.constructor);
    const idMetadata = metadatas && metadatas.find(val => !val.isRelation && val.isIdentifyColumn);
    if (!idMetadata) {
        return undefined;
    }
    if (typeof entity[idMetadata.propertyName] === "number" || typeof entity[idMetadata.propertyName] === "string") {
        return entity[idMetadata.propertyName];
    }
    return undefined;
}

/**
 * Returns redis properties metadata
 * 
 * @export
 * @param entityOrEntityClass 
 * @returns 
 */
export function getEntityProperties(entityOrEntityClass: object | Function): PropertyMetadata[] | undefined {
    return Reflect.getMetadata(REDIS_PROPERTIES, typeof entityOrEntityClass === "function" ? entityOrEntityClass : entityOrEntityClass.constructor);
}

/**
 * Return full hash id
 * 
 * @export
 * @param entityOrEntityClass 
 * @param [hashId]
 * @returns 
 */
export function getEntityFullId(entityOrEntityClass: object | Function, hashId?: string | number): string | undefined {
    const name = getEntityName(entityOrEntityClass);
    const id = typeof hashId !== "undefined"
        ? hashId
        : typeof entityOrEntityClass === "object"
            ? getEntityId(entityOrEntityClass)
            : undefined;        
    if (name && typeof id !== "undefined") {
        return `e:${name}:${id}`;
    }
}