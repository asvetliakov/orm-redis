import * as redis from "redis";
import { AlreadyConnectedError } from "../../Errors/Errors";
import { EntitySubscriberInterface } from "../../Subscriber/EntitySubscriberInterface";
import { PubSubSubscriberInterface } from "../../Subscriber/PubSubSubscriberInterface";
import { cleanRedisConnection, createRawRedisClient, createRedisConnection } from "../../testutils/redis";
import { ShouldThrowError } from "../../testutils/ShouldThrowError";
import { Connection } from "../Connection";

describe("With default connection", () => {
    let conn: Connection;
    beforeAll(async () => {
        conn = await createRedisConnection();
    });

    afterEach(async () => {
        await conn.flushdb();
    });

    afterAll(async () => {
        await cleanRedisConnection(conn);
    });

    it("Throws error if trying to connect again", async () => {
        try {
            await conn.connect({});
            throw new ShouldThrowError();
        } catch (e) {
            if (e instanceof ShouldThrowError) { throw e; }
            expect(e).toBeInstanceOf(AlreadyConnectedError);
        }
    });

    describe("Disconnects and throw error", () => {
        it("When failed to init pub sub listener", async () => {
            class TestPubSub {
                public constructor() {
                    throw new Error();
                }
            }
            try {
                const client = await createRedisConnection({
                    pubSubSubscriber: TestPubSub
                });
                // Need to disconnect in case if createConnection won't throw
                await client.disconnect();
                throw new ShouldThrowError();
            } catch (e) {
                if (e instanceof ShouldThrowError) { throw e; }
            }
        });

        it("When failed to init entity subscribers", async () => {
            class TestEntitySubscriber implements EntitySubscriberInterface<any> {
                public constructor() {
                    throw new Error();
                }
                public listenTo(): Function { return undefined as any; }
            }
            try {
                const client = await createRedisConnection({
                    entitySubscribers: [TestEntitySubscriber]
                });
                // Need to disconnect in case if createConnection won't throw
                await client.disconnect();
                throw new ShouldThrowError();
            } catch (e) {
                if (e instanceof ShouldThrowError) { throw e; }
            }
        });
    });

    describe("Monitoring", () => {
        it("Starts another connection for monigoring", async () => {
            const loggerSpy = jest.fn();
            await conn.startMonitoring(loggerSpy);
            // need to wait sligtly
            await new Promise(resolve => setTimeout(resolve, 300));

            await conn.flushdb();
            await new Promise(resolve => setTimeout(resolve, 300));
            expect(loggerSpy).toBeCalledWith(expect.any(String), ["flushdb"], expect.any(String));
        });

        it("Stops monitoring", async () => {
            const loggerSpy = jest.fn();
            await conn.startMonitoring(loggerSpy);
            await new Promise(resolve => setTimeout(resolve, 200));
            await conn.stopMonitoring();

            await conn.client.pingAsync("test");
            expect(loggerSpy).not.toBeCalledWith(expect.any(String), ["ping", "test"], expect.any(String));
        });
    });

    it("Works within transaction", async () => {
        await conn.transaction(executor => {
            executor.sadd("testlist", "1", "2", "3");
            executor.hmset("somehash", { val1: "test", val2: 5 });
        });
        const testlist = await conn.client.smembersAsync("testlist");
        expect(testlist).toEqual(["1", "2", "3"]);
        const testhash = await conn.client.hgetallAsync("somehash");
        expect(testhash).toEqual({ val1: "test", val2: "5" });
    });

    it("Works within batch", async () => {
        await conn.batch(executor => {
            executor.sadd("testlist", "1", "2", "3");
            executor.hmset("somehash", { val1: "test", val2: 5 });
        });
        const testlist = await conn.client.smembersAsync("testlist");
        expect(testlist).toEqual(["1", "2", "3"]);
        const testhash = await conn.client.hgetallAsync("somehash");
        expect(testhash).toEqual({ val1: "test", val2: "5" });
    });
});



describe("PubSub", () => {
    let client: redis.RedisClient;
    let conn: Connection;

    beforeAll(async () => {
        client = await createRawRedisClient();
    });

    afterEach(async () => {
        if (conn) {
            await cleanRedisConnection(conn);
        }
    });
    
    afterAll(async () => {
        if (client) {
            await client.quitAsync();
        }
    });
    
    it("Listens for message", async () => {
        const messages: string[][] = [];
        class TestListener implements PubSubSubscriberInterface {
            public onMessage: jest.Mock<any>;
            public constructor() {
                this.onMessage = jest.fn().mockImplementation((channel: string, value: string) => {
                    messages.push([channel, value]);
                });
            }
        }
        conn = await createRedisConnection({ pubSubSubscriber: TestListener });
        await conn.subscribe("some channel", "some other channel");
        await client.publishAsync("some channel", "some message");
        await client.publishAsync("some other channel", "some message");
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(messages[0]).toEqual(["some channel", "some message"]);
        expect(messages[1]).toEqual(["some other channel", "some message"]);
    });
    
    it("Listens for message with pattern", async () => {
        const messages: string[][] = [];
        class TestListener implements PubSubSubscriberInterface {
            public onPMessage: jest.Mock<any>;
            public constructor() {
                this.onPMessage = jest.fn().mockImplementation((pattern: string, channel: string, value: string) => {
                    messages.push([pattern, channel, value]);
                });
            }
        }
        conn = await createRedisConnection({ pubSubSubscriber: TestListener });
        await conn.psubscribe("channel?");
        await client.publishAsync("channel1", "some message");
        await client.publishAsync("channel2", "some message");
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(messages[0]).toEqual(["channel?", "channel1", "some message"]);
        expect(messages[1]).toEqual(["channel?", "channel2", "some message"]);
    });
    
    it("Unsubscribes", async () => {
        const messages: string[][] = [];
        class TestListener implements PubSubSubscriberInterface {
            public onPMessage: jest.Mock<any>;
            public onMessage: jest.Mock<any>;
            public constructor() {
                this.onPMessage = jest.fn().mockImplementation((pattern: string, channel: string, value: string) => {
                    messages.push([pattern, channel, value]);
                });
                this.onMessage = jest.fn().mockImplementation((channel: string, value: string) => {
                    messages.push([channel, value]);
                });
            }
        }
        conn = await createRedisConnection({ pubSubSubscriber: TestListener });
        await conn.subscribe("channel");
        await conn.psubscribe("test?");
        
        await conn.unsubscribe("channel");
        await conn.punsubscribe("test?");

        await client.publishAsync("channel1", "some message");
        await client.publishAsync("channel2", "some message");
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(messages).toHaveLength(0);
    });
    
    it("Listens for subscribe/unsubscribe events", async () => {
        const messages: string[][] = [];
        class TestListener implements PubSubSubscriberInterface {
            public onSubscribe: jest.Mock<any>;
            public onPSubscribe: jest.Mock<any>;
            public onUnsubscribe: jest.Mock<any>;
            public onPUnsubscribe: jest.Mock<any>;
            public constructor() {
                this.onSubscribe = jest.fn((channel: string) => messages.push(["subscribe", channel]));
                this.onPSubscribe = jest.fn((channel: string) => messages.push(["psubscribe", channel]));
                this.onUnsubscribe = jest.fn((channel: string) => messages.push(["unsubscribe", channel]));
                this.onPUnsubscribe = jest.fn((channel: string) => messages.push(["punsubscribe", channel]));
            }
        }
        conn = await createRedisConnection({ pubSubSubscriber: TestListener });
        await conn.subscribe("channel");
        await conn.psubscribe("test?");
        
        await conn.unsubscribe("channel");
        await conn.punsubscribe("test?");
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(messages).toHaveLength(4);
        expect(messages[0]).toEqual(["subscribe", "channel"]);
        expect(messages[1]).toEqual(["psubscribe", "test?"]);
        expect(messages[2]).toEqual(["unsubscribe", "channel"]);
        expect(messages[3]).toEqual(["punsubscribe", "test?"]);
    });
});
