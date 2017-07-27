import { MetadataError } from "../Errors/Errors";
import { PropertyMetadata, REDIS_PROPERTIES, RelationOptions, RelationTypeFunc } from "../Metadata/Metadata";

/** 
 * default options
 */
const defaultOptions: RelationOptions = {
    cascadeInsert: false,
    cascadeUpdate: false
};

/**
 * Defines single or multiple relation property
 * 
 * @export
 * @param type Type function which must return type of relation / property type
 * @param propertyType Property type. For single relation must be 
 */
export function RelationProperty(type: RelationTypeFunc): PropertyDecorator;
/**
 * Defines single or multiple relation property
 * 
 * @export
 * @param type Type function which must return type of relation / property type
 * @param [options] Options
 */
export function RelationProperty(type: RelationTypeFunc, options?: RelationOptions): PropertyDecorator;

/**
 * Defines single or multiple relation property
 * 
 * @export
 * @param type 
 * @param [options] 
 * @returns 
 */
export function RelationProperty(type: RelationTypeFunc, options?: RelationOptions): PropertyDecorator {
    return function (target: Object, propertyKey: string): void {
        const designType = Reflect.getMetadata("design:type", target, propertyKey);
        
        const redisPropertyName = options && options.propertyName ? options.propertyName : propertyKey;
        
        const relationTypes = type();

        let propertyType: Function;
        if (Array.isArray(relationTypes)) {
            [, propertyType] = relationTypes;
        } else {
            if (designType === Object) {
                throw new MetadataError(target.constructor, `Relation's ${propertyKey} property type is detected as simple Object. This is error. Specify property type explicitly`);
            }
            propertyType = designType;
        }

        const finalOptions = {
            ...defaultOptions,
            ...options
        };

        const properties: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, target.constructor) || [];
        properties.push({
            isRelation: true,
            propertyName: propertyKey,
            propertyRedisName: redisPropertyName,
            propertyType: propertyType,
            relationTypeFunc: type,
            relationOptions: finalOptions
        });
        Reflect.defineMetadata(REDIS_PROPERTIES, properties, target.constructor);
    };
}