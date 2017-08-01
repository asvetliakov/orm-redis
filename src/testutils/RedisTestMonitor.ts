import { RedisClient } from "redis";
import { Connection } from "../Connection/Connection";
import { createRawRedisClient, getDatabaseNumberForConnection } from "./redis";

export class RedisTestMonitor {
    // Array of calls -> results without any timestamps
    private _calls: string[][][] = [];

    /**
     * Redis client
     * 
     * @private
     */
    private client: RedisClient;

    /**
     * Filter calls for specific redis db (each test connection connects to different db)
     * 
     * @private
     */
    private filterDbNumber?: string;

    /**
     * All monitor calls in format [request, response]
     * 
     * @readonly
     */
    public get calls(): string[][][] {
        return this._calls;
    }

    /**
     * Request only calls
     * 
     * @readonly
     */
    public get requests(): string[][] {
        return this._calls.map(([request, result]) => request);
    }

    /**
     * Responses only
     * 
     * @readonly
     */
    public get responses(): string[][] {
        return this._calls.map(([request, result]) => result);
    }


    /**
     * Release monitor
     * 
     * @returns 
     */
    public async release(): Promise<void> {
        await this.client.quitAsync();
    }

    /**
     * Reset monitor calls
     * @param timeToWaitMs Wait some time before clearing
     * 
     */
    public async clearMonitorCalls(timeToWaitMs?: number): Promise<void> {
        if (timeToWaitMs) {
            await this.wait(timeToWaitMs);
        }
        this._calls = [];
    }

    /**
     * Wait some time
     * 
     * @param timeToWaitMs 
     * @returns 
     */
    public async wait(timeToWaitMs: number): Promise<void> {
        await new Promise<void>(resolve => setTimeout(resolve, timeToWaitMs));
    }

    /**
     * Logger
     * 
     * @protected
     * @param time 
     * @param commandArgs 
     * @param reply 
     * @returns 
     */
    protected monitor(time: number, commandArgs: string[], reply: string): void {
        const repliesArgs = reply.split(" "); // 1500637727.256744 [12 172.20.0.1:48986] \"multi\"
        const justReply = repliesArgs.splice(3).map(r => r.slice(1, -1));
        const dbNumber = repliesArgs[1].slice(1); // [12 172.20.0.1:48986]
        if (this.filterDbNumber) {
            if (!dbNumber) {
                return;
            }
            if (dbNumber !== this.filterDbNumber) {
                return;
            }
        }
        this._calls.push([commandArgs, justReply as any]);
    }

    /**
     * Create monitor
     * 
     * @static
     * @param [connection] Monitor only for requests/replies for given connection db
     * @returns 
     */
    public static async create(connection?: Connection): Promise<RedisTestMonitor> {
        const instance = new RedisTestMonitor();
        if (connection) {
            instance.filterDbNumber = getDatabaseNumberForConnection(connection);
        }
        instance.client = await createRawRedisClient();
        instance.client.on("monitor", instance.monitor.bind(instance));
        await instance.client.monitorAsync();
        return instance;
    }
}