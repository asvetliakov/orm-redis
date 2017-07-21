import { getRedisHashId, getRedisHashName, isRedisHash, REDIS_COLLECTION_VALUE, REDIS_VALUE } from "../Metadata/Metadata";

function prepareValue(value: any, target: any, propertyKey: string): string | undefined {
    if (isRedisHash(value)) {
        const hashId = getRedisHashId(value);
        const hashName = getRedisHashName(value);
        return `e:${hashName}:${hashId}`;
    } else {
        const hashId = getRedisHashId(target);
        const hashName = getRedisHashName(target);
        if (value instanceof Map) {
            return `m:e:${hashName}:${hashId}:${propertyKey}`;
        } else if (value instanceof Set) {
            return `a:e:${hashName}:${hashId}:${propertyKey}`;
        } else if (typeof value === "number") {
            return `i:${value}`;
        } else if (typeof value === "string") {
            return `s:${value}`;
        } else if (typeof value === "boolean") {
            return value ? `b:1` : `b:0`;
        } else if (typeof value === "object") {
            if (value === null) {
                return "null";
            } else if (value instanceof Date) {
                return `d:${value.getTime()}`;
            } else {
                return `j:${JSON.stringify(value)}`;
            }
        } else {
            return `j:${JSON.stringify(value)}`;
        }
    }
}

/**
 * Decorator to emulate REDIS_VALUE metadata which will be available after entity fetching/saving
 * 
 * @export
 * @param value 
 * @returns 
 */
export function TestRedisInitialValue(value?: any): PropertyDecorator {
    return function (target: object, propertyKey: string ): PropertyDescriptor | undefined { 
        // Set explicitly value
        if (typeof value !== "undefined") {
            const preparedValue = prepareValue(value, target, propertyKey);
            Reflect.defineMetadata(REDIS_VALUE, preparedValue, target, propertyKey);
        } else {
            let val: any;
            const descriptor: PropertyDescriptor = {
                set: function (newValue: any) {
                    const metadata = Reflect.getMetadata(REDIS_VALUE, target, propertyKey);
                    // first setting
                    if (typeof metadata === "undefined") {
                        Reflect.defineMetadata(REDIS_VALUE, prepareValue(newValue, target, propertyKey), target, propertyKey);
                    }
                    val = newValue;
                },
                get: function () {
                    return val;
                }
            };
            return descriptor;
        }
    };
}

function getPreparedCollection(coll: Map<any, any> | Set<any>, target: any, propertyKey: string): string[] | { [key: string]: string } {
    if (coll instanceof Map) {
        const obj: { [key: string]: string } = {};
        for (const [key, val] of coll) {
            const prepkey = prepareValue(key, target, propertyKey);
            const prepVal = prepareValue(val, target, propertyKey);
            if (typeof prepkey !== "undefined" && typeof prepVal !== "undefined") {
                obj[prepkey] = prepVal;
            }
        }
        return obj;
    } else {
        return [...coll.values()].map(val => prepareValue(val, target, propertyKey)).filter(val => typeof val !== "undefined") as string[];
    }
}

export function TestRedisInitialCollectionValue(value?: Map<any, any> | Set<any>): PropertyDecorator {
    return function (target: object, propertyKey: string): PropertyDescriptor | undefined { 
        if (value) {
            Reflect.defineMetadata(REDIS_VALUE, prepareValue(value, target, propertyKey), target, propertyKey);
            Reflect.defineMetadata(REDIS_COLLECTION_VALUE, getPreparedCollection(value, target, propertyKey), target, propertyKey);
        } else {
            let val: any;
            const descriptor: PropertyDescriptor = {
                set: function (newValue: any) {
                    const metadata = Reflect.getMetadata(REDIS_VALUE, target, propertyKey);
                    // first setting
                    if (typeof metadata === "undefined") {
                        Reflect.defineMetadata(REDIS_VALUE, prepareValue(newValue, target, propertyKey), target, propertyKey);
                        if (newValue instanceof Map || newValue instanceof Set) {
                            Reflect.defineMetadata(REDIS_COLLECTION_VALUE, getPreparedCollection(newValue, target, propertyKey), target, propertyKey);
                        }
                    }
                    val = newValue;
                },
                get: function () {
                    return val;
                }
            };
            return descriptor;
        }
    };
}