import { LazyMap } from "./Collections/LazyMap";
import { LazySet } from "./Collections/LazySet";
import { RedisLazyMap } from "./Collections/RedisLazyMap";
import { RedisLazySet } from "./Collections/RedisLazySet";
import { Connection, ConnectionOptions } from "./Connection/Connection";
import { RedisManager } from "./Persistence/RedisManager";
import { EntitySubscriberInterface } from "./Subscriber/EntitySubscriberInterface";
import { PubSubSubscriberInterface } from "./Subscriber/PubSubSubscriberInterface";
import { getFromContainer, useContainer } from "./utils/Container";


/**
 * Create redis connection
 * 
 * @export
 * @param options 
 * @returns 
 */
export async function createRedisConnection(options: ConnectionOptions): Promise<Connection> {
    const conn = getFromContainer(Connection);
    await conn.connect(options);
    return conn;
}

/**
 * Return redis manager
 * 
 * @export
 * @returns 
 */
export function getRedisManager(): RedisManager {
    const conn = getFromContainer(Connection);
    return conn.manager;
}

export { Connection };
export { ConnectionOptions };
export { RedisManager };
export { LazyMap };
export { LazySet };
export { RedisLazyMap };
export { RedisLazySet };
export { EntitySubscriberInterface };
export { PubSubSubscriberInterface };
export * from "./Metadata/Metadata";
export * from "./Errors/Errors";
export * from "./Decorators/Entity";
export * from "./Decorators/IdentifyProperty";
export * from "./Decorators/Property";
export * from "./Decorators/RelationProperty";
export { useContainer };