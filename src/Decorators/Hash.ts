import { REDIS_HASH } from "../Metadata/Metadata";

/**
 * Defines redis hash
 * 
 * @export
 * @param {string} [name] 
 * @returns void
 */
export function Hash(name?: string): ClassDecorator {
    return function (constructor: Function) {
        Reflect.defineMetadata(REDIS_HASH, name ? name : constructor.name, constructor);
    };
}