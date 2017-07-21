import { AlreadyConnectedError } from "../Errors/Errors";
import { RedisManager } from "../Persistence/RedisManager";
import { EntitySubscriberInterface } from "../Subscriber/EntitySubscriberInterface";
import { PubSubSubscriberInterface } from "../Subscriber/PubSubSubscriberInterface";
import { getFromContainer } from "../utils/Container";
import * as redis from "../utils/PromisedRedis";

export interface ConnectionOptions extends redis.ClientOpts {
    /**
     * Array of entity subscribers
     */
    entitySubscribers?: Array<{ new(...args: any[]): EntitySubscriberInterface<any> }>;
    /**
     * PubSub subscriber
     */
    pubSubSubscriber?: { new(...args: any[]): PubSubSubscriberInterface };
    
}

export class Connection {
    /**
     * Manager instance
     */
    public manager: RedisManager;
    
    /**
     * Connection status
     */
    public isConnected: boolean = false;
    
    /**
     * Redis client instance
     */
    public client: redis.RedisClient;
    
    /**
     * PubSub redis client
     * 
     * @private
     */
    private pubsub: redis.RedisClient;
    
    /**
     * Monitor redis client
     * 
     * @private
     */
    private monitor?: redis.RedisClient;
    
    /**
     * Options
     * 
     * @private
     */
    private options: ConnectionOptions;
    
    /**
     * Creates an instance of Connection.
     */
    public constructor() { }
    
    /**
     * Init connection & connect
     * 
     * @param options 
     */
    public async connect(options: ConnectionOptions): Promise<void> {
        if (this.isConnected) {
            throw new AlreadyConnectedError();
        }
        this.options = options;
        this.client = redis.createClient(options);
        this.pubsub = redis.createClient(options);
        try {
            this.initPubSubListener();
            const subscribers = this.loadEntitySubscribers(this.options.entitySubscribers);
            // tslint:disable-next-line:no-unused-expression
            subscribers;
            this.isConnected = true;
        } catch (e) {
            await this.disconnect();
            throw e;
        }
        // this.redisClient = redis.createClient();
        // await this.redisClient.connect();
        // try {
        //   const subscribers = this.loadSubscribers();
        //   this.manager = new RedisManager(this, subscribers)
        // } catch (e) {
        //
        // }
        // this.manager = new RedisManager();
        
    }

    /**
     * Disconnect all connections
     * 
     * @returns 
     */
    public async disconnect(): Promise<void> {
        // Stop monitor connection if exist
        if (this.monitor) {
            await this.monitor.quitAsync();
        }
        // Stop pubsub connection
        if (this.pubsub) {
            await this.pubsub.quitAsync();
        }
        // Stop client connection
        if (this.client) {
            await this.client.quitAsync();
        }
        this.isConnected = false;
    }
    
    /**
     * Creates monitor connection and executes MONITOR command
     */
    public async startMonitoring(logger: (time: number, args: any[], reply: string) => void): Promise<void> {
        if (this.monitor) {
            return;
        }
        this.monitor = redis.createClient(this.options);
        this.monitor.on("monitor", logger);
        await this.monitor.monitorAsync();
    }
    
    /**
     * Stops any monitoring
     * 
     * @returns 
     */
    public async stopMonitoring(): Promise<void> {
        if (this.monitor) {
            await this.monitor.quitAsync();
            this.monitor = undefined;
        }
    }
    
    /**
     * Subscribe for one or more chanels
     */
    public async subscribe(channel: string, ...channels: string[]): Promise<string> {
        return await this.pubsub.subscribeAsync(channel, ...channels);
    }
    
    /**
     * Stop listening for messages posted to the given channels.
     */
    public async unsubscribe(channel: string, ...channels: string[]): Promise<string> {
        return await this.pubsub.unsubscribeAsync(channel, ...channels);
    }

    /**
     * Stop listening for messages posted to channels matching the given patterns.
     */
    public async psubscribe(pattern: string, ...patterns: string[]): Promise<string> {
        return await this.pubsub.psubscribeAsync(pattern, ...patterns);
    }
    
    /**
     * Stop listening for messages posted to channels matching the given patterns.
     */
    public async punsubscribe(pattern: string, ...channels: string[]): Promise<string> {
        return await this.pubsub.punsubscribeAsync(pattern, ...channels);
    }
    
    /**
     * Remove all keys from the current database.
     */
    public async flushdb(): Promise<void> {
        await this.client.flushdbAsync();
    }
    
    /**
     * Execute multiple comamnds inside transaction
     * 
     * @param executor 
     * @param [atomic=false] 
     * @returns 
     */
    public async transaction(executor: (multi: redis.Commands<void>) => void, atomic: boolean = false): Promise<any[]> {
        const multi = this.client.multi();
        executor(multi);
        return new Promise<any[]>((resolve, reject) => {
            const func = atomic ? multi.exec_atomic : multi.exec;
            func.call(multi, (err: Error, result: any[]) => {
                err ? reject(err) : resolve(result);
            });
        });
    }
    
    /**
     * Execute multiple commands in batch without transaction
     * 
     * @param executor 
     * @returns 
     */
    public async batch(executor: (batch: redis.Commands<void>) => void): Promise<any[]> {
        const batch = this.client.batch();
        executor(batch);
        return new Promise<any[]>((resolve, reject) => {
            batch.exec((err, result) => {
                err ? reject(err) : resolve(result);
            });
        });
    }
    
    /**
     * Init pubsub connection and listeners
     * 
     * @private
     */
    private initPubSubListener(): void {
        if (typeof this.options.pubSubSubscriber === "function") {
            const listener = getFromContainer(this.options.pubSubSubscriber);
            if (listener.onMessage) {
                this.pubsub.on("message", listener.onMessage.bind(listener));
            }
            if (listener.onMessageBuffer) {
                this.pubsub.on("message_buffer", listener.onMessageBuffer.bind(listener));
            }
            if (listener.onPMessage) {
                this.pubsub.on("pmessage", listener.onPMessage.bind(listener));
            }
            if (listener.onPMessageBuffer) {
                this.pubsub.on("pmessage_buffer", listener.onPMessageBuffer.bind(listener));
            }
            if (listener.onSubscribe) {
                this.pubsub.on("subscribe", listener.onSubscribe.bind(listener));
            }
            if (listener.onPSubscribe) {
                this.pubsub.on("psubscribe", listener.onPSubscribe.bind(listener));
            }
            if (listener.onUnsubscribe) {
                this.pubsub.on("unsubscribe", listener.onUnsubscribe.bind(listener));
            }
            if (listener.onPUnsubscribe) {
                this.pubsub.on("punsubscribe", listener.onPUnsubscribe.bind(listener));
            }
        }
    }
    
    /**
     * Instantiate all entity subscribers
     * 
     * @private
     * @param subscriberConstructors 
     * @returns 
     */
    private loadEntitySubscribers(subscriberConstructors?: Array<{ new(...args: any[]): EntitySubscriberInterface<any> }>): Array<EntitySubscriberInterface<any>> {
        const subscribers: Array<EntitySubscriberInterface<any>> = [];
        if (subscriberConstructors) {
            for (const cl of subscriberConstructors) {
                subscribers.push(getFromContainer(cl));
            }
        }
        return subscribers;
    }
}