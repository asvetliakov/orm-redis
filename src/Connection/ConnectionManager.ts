import { ConnectionAlreadyExistError } from "../Errors/Errors";
import { Connection, ConnectionOptions } from "./Connection";

/**
 * Handles active redis connections
 * 
 * @export
 * @class ConnectionManager
 */
export class ConnectionManager {
    /**
     * Active connections
     * 
     * @protected
     */
    protected connections: Map<string, Connection> = new Map();

    /**
     * Get created connection
     * 
     * @param [name="default"] 
     * @returns 
     */
    public getConnection(name: string = "default"): Connection | undefined {
        return this.connections.get(name);
    }

    /**
     * Create connection to redis
     * 
     * @param options 
     * @param [name="default"] Connection name
     * @returns 
     */
    public async createConnection(options: ConnectionOptions, name: string = "default"): Promise<Connection> {
        if (this.connections.has(name)) {
            throw new ConnectionAlreadyExistError(name);
        }
        const connection = new Connection(name, options);
        await connection.connect();
        this.connections.set(name, connection);
        return connection;
    }

    /**
     * Remove connection from manager
     * 
     * @param [name="default"] Connection name
     * @param [disconnect=true] Disconnect connection
     * @returns 
     */
    public async removeConnection(name: string = "default", disconnect: boolean = true): Promise<void> {
        const conn = this.connections.get(name);
        if (conn) {
            if (disconnect) {
                await conn.disconnect();
            }
            this.connections.delete(name);
        }
    }
}