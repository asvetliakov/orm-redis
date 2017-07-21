import { AlreadyConnectedError } from "../../Errors/Errors";
import { EntitySubscriberInterface } from "../../Subscriber/EntitySubscriberInterface";
import { PubSubSubscriberInterface } from "../../Subscriber/PubSubSubscriberInterface";
import { cleanRedisConnection, createRedisConnection } from "../../testutils/redis";
import { ShouldThrowError } from "../../testutils/ShouldThrowError";
import { Connection } from "../Connection";

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
            public listenTo() { return; }
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
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await conn.flushdb();
        expect(loggerSpy).toBeCalledWith(expect.any(String), ["flushdb"], expect.any(String));
    });
    
    it("Stops monitoring", async () => {
        const loggerSpy = jest.fn();
        await conn.startMonitoring(loggerSpy);
        await new Promise(resolve => setTimeout(resolve, 80));
        await conn.stopMonitoring();
        
        await conn.client.pingAsync("test");
        expect(loggerSpy).not.toBeCalledWith(expect.any(String), ["ping", "test"], expect.any(String));
    });
});


describe("PubSub", () => {
    let anotherConn: Connection;
    
    afterEach(async () => {
        await cleanRedisConnection(anotherConn);
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
        anotherConn = await createRedisConnection({ pubSubSubscriber: TestListener });
        await anotherConn.subscribe("some channel", "some other channel");
        await conn.client.publishAsync("some channel", "some message");
        await conn.client.publishAsync("some other channel", "some message");
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
        anotherConn = await createRedisConnection({ pubSubSubscriber: TestListener });
        await anotherConn.psubscribe("channel?");
        await conn.client.publishAsync("channel1", "some message");
        await conn.client.publishAsync("channel2", "some message");
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
        anotherConn = await createRedisConnection({ pubSubSubscriber: TestListener });
        await anotherConn.subscribe("channel");
        await anotherConn.psubscribe("test?");
        
        await anotherConn.unsubscribe("channel");
        await anotherConn.punsubscribe("test?");

        await conn.client.publishAsync("channel1", "some message");
        await conn.client.publishAsync("channel2", "some message");
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
        anotherConn = await createRedisConnection({ pubSubSubscriber: TestListener });
        await anotherConn.subscribe("channel");
        await anotherConn.psubscribe("test?");
        
        await anotherConn.unsubscribe("channel");
        await anotherConn.punsubscribe("test?");
        expect(messages).toHaveLength(4);
        expect(messages[0]).toEqual(["subscribe", "channel"]);
        expect(messages[1]).toEqual(["psubscribe", "test?"]);
        expect(messages[2]).toEqual(["unsubscribe", "channel"]);
        expect(messages[3]).toEqual(["punsubscribe", "test?"]);
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
