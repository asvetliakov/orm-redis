import { REDIS_ENTITY } from "../Metadata/Metadata";

/**
 * Defines redis entity class
 * 
 * @export
 * @param {string} [name] 
 * @returns void
 */
export function Entity(name?: string): ClassDecorator {
    return function (constructor: Function) {
        Reflect.defineMetadata(REDIS_ENTITY, name ? name : constructor.name, constructor);
    };
}