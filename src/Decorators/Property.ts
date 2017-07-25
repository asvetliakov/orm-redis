import { LazyMap } from "../collections/LazyMap";
import { LazySet } from "../collections/LazySet";
import { PropertyMetadata, REDIS_PROPERTIES } from "../Metadata/Metadata";

export type ValidType =
    typeof Number |
    typeof String |
    typeof Boolean |
    typeof Object |
    typeof Array |
    typeof Date |
    typeof Map |
    typeof LazyMap |
    typeof LazySet |
    typeof Set;


/**
 * Defines redis hash property
 * 
 * @export
 * @param [type] 
 * @returns 
 */
export function Property(type?: ValidType): PropertyDecorator;
/**
 * Defines redis hash property
 * 
 * @export
 * @param name Redis name for property
 * @param [type] 
 * @returns 
 */
export function Property(name: string, type?: ValidType): PropertyDecorator; 

/**
 * Defines redis hash property
 * 
 * @export
 * @param [name] Property name to store in redis
 * @returns 
 */
export function Property(nameOrType?: string | ValidType, type?: ValidType): PropertyDecorator {
    return function (target: Object, propertyKey: string): void {
        const designType: any = Reflect.getMetadata("design:type", target, propertyKey);
        const name = typeof nameOrType === "string" ? nameOrType : propertyKey;
        const propertyType = typeof nameOrType === "function"
            ? nameOrType
            : type
                ? type
                : designType;        

        const properties: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, target.constructor) || [];
        properties.push({
            propertyName: propertyKey,
            propertyRedisName: name,
            isIdentifyColumn: false,
            propertyType: propertyType,
            isRelation: false,
        });
        Reflect.defineMetadata(REDIS_PROPERTIES, properties, target.constructor);
    };
}