import { Connection, ConnectionOptions } from "./Connection/Connection";
import { RedisManager } from "./Persistence/RedisManager";
import { getFromContainer } from "./utils/Container";

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

export function getRedisManager(): RedisManager {
    const conn = getFromContainer(Connection);
    return conn.manager;
}