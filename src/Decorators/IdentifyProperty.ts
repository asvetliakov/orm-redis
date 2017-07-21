import { PropertyMetadata, REDIS_PROPERTIES } from "../Metadata/Metadata";

/**
 * Defines identify property for given redis hash.
 * Hash must contain one IdentifyProperty
 * 
 * @export
 * @param type Type
 * @param [name] Redis property name
 * @returns 
 */
export function IdentifyProperty(nameOrType?: string | typeof Number | typeof String, type?: typeof Number | typeof String): PropertyDecorator {
    return function (target: Object, propertyKey: string): void {
        const designType: any = Reflect.getMetadata("design:type", target, propertyKey);
        const name = typeof nameOrType === "string" ? nameOrType : propertyKey;
        const propertyType = typeof nameOrType === "function"
            ? nameOrType
            : type
                ? type
                : designType;        

        if (propertyType !== String && propertyType !== Number) {
            throw new Error("Identify property must be string or number type");
        }
        const properties: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, target.constructor) || [];
        properties.push({
            propertyName: propertyKey,
            propertyRedisName: name,
            isIdentifyColumn: true,
            propertyType: propertyType,
            isRelation: false
        });
        Reflect.defineMetadata(REDIS_PROPERTIES, properties, target.constructor);
    };
}