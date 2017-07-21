import { Connection, ConnectionOptions } from "../Connection/Connection";
import * as redis from "../utils/PromisedRedis";


/**
 * Get available database from pool of databases (presented as SET in redis)
 * 
 * @returns 
 */
export async function getAvailableDatabase(): Promise<string> {
    const client = createRawRedisClient();
    let dbNumber: string | null = await client.spopAsync("available_db");
    // Set doesn't exist
    if (!dbNumber) {
        // Create set of db connetions
        await client.saddAsync("available_db", ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"]);
        // Obtain again
        dbNumber = await client.spopAsync("available_db");
    }
    if (!dbNumber) {
        throw new Error("Unable to obtain database number");
    }
    await client.quitAsync();
    return dbNumber;
}

/**
 * Release available database and return it to the pool
 * 
 * @export
 * @param dbNumber 
 * @returns 
 */
export async function releaseDatabase(dbNumber: string): Promise<void> {
    const client = redis.createClient(parseInt(process.env.REDIS_PORT!) || 6379, process.env.REDIS_HOST);
    await client.saddAsync("available_db", dbNumber);
    await client.quitAsync();
}

/**
 * Create redis client
 * 
 * @export
 * @returns 
 */
export function createRawRedisClient(): redis.RedisClient {
    const client = redis.createClient(parseInt(process.env.REDIS_PORT!) || 6379, process.env.REDIS_HOST);
    return client;
}


// Just in case if the global state will be shared between tests
const connectionToDbNumber = new WeakMap<Connection, string>();

/**
 * Create redis connection
 * 
 * @param [options={}]
 * @export
 * @returns 
 */
export async function createRedisConnection(options: ConnectionOptions = {}): Promise<Connection> {
    const dbNumber = await getAvailableDatabase();
    const connection = new Connection();
    connectionToDbNumber.set(connection, dbNumber);
    try {
        await connection.connect({
            db: dbNumber.toString(),
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT!) || 6379,
            ...options
        });
    } catch (e) {
        await releaseDatabase(dbNumber);
        throw e;
    }
    return connection;
}

/**
 * Clean & release redis connection
 * 
 * @export
 * @param connection 
 * @returns 
 */
export async function cleanRedisConnection(connection: Connection): Promise<void> {
    if (connection.isConnected) {
        await connection.flushdb();
    }
    const dbNumber = connectionToDbNumber.get(connection);
    if (dbNumber) {
        await releaseDatabase(dbNumber);
    }
    if (connection.isConnected) {
        await connection.disconnect();
    }
}