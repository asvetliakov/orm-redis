import { LazyMap } from "./Collections/LazyMap";
import { LazySet } from "./Collections/LazySet";
import { RedisLazyMap } from "./Collections/RedisLazyMap";
import { RedisLazySet } from "./Collections/RedisLazySet";
import { Connection, ConnectionOptions } from "./Connection/Connection";
import { ConnectionManager } from "./Connection/ConnectionManager";
import { NoSuchConnectionError } from "./Errors/Errors";
import { RedisManager } from "./Persistence/RedisManager";
import { EntitySubscriberInterface } from "./Subscriber/EntitySubscriberInterface";
import { PubSubSubscriberInterface } from "./Subscriber/PubSubSubscriberInterface";
import { getFromContainer, useContainer } from "./utils/Container";


/**
 * Create redis connection
 * 
 * @export
 * @param options Connection options
 * @param [name="defualt"] Connection name
 * @returns 
 */
export async function createRedisConnection(options: ConnectionOptions, name: string = "default"): Promise<Connection> {
    const connectionManager = getFromContainer(ConnectionManager);
    return await connectionManager.createConnection(options, name);
}

/**
 * Return connection manager
 * 
 * @export
 * @returns 
 */
export function getConnectionManager(): ConnectionManager {
    return getFromContainer(ConnectionManager);
}

/**
 * Return redis manager for connection
 * 
 * @export
 * @param [connectionName="default"] Connection name
 * @returns 
 */
export function getRedisManager(connectionName: string = "default"): RedisManager {
    const connectionManager = getFromContainer(ConnectionManager);
    const conn = connectionManager.getConnection(connectionName);
    if (!conn) {
        throw new NoSuchConnectionError(connectionName);
    }
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