import { Connection } from "../../Connection/Connection";
import { Hash } from "../../Decorators/Hash";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { cleanRedisConnection, createRedisConnection } from "../../testutils/redis";
import { RedisTestMonitor } from "../../testutils/RedisTestMonitor";
import { RedisManager } from "../RedisManager";

let conn: Connection;
let manager: RedisManager;
let monitor: RedisTestMonitor;
beforeAll(async () => {
    conn = await createRedisConnection();
    manager = conn.manager;
    monitor = await RedisTestMonitor.create(conn);
});

afterEach(async () => {
    monitor.clearMonitorCalls();
    await conn.flushdb();
});

afterAll(async () => {
    await monitor.release();
    await cleanRedisConnection(conn);
});

describe("Save", () => {
    it("Saves simple entity", async () => {
        @Hash()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "abc";

            @Property("boolProp")
            public prop2: boolean = true;

            @Property(Date)
            public prop3: Date = new Date(2016, 10, 10, 10, 10, 10);

            @Property()
            public prop4: object = { a: "abc", d: 5 };

            @Property(String)
            public prop5: string | null = null;

            @Property(String)
            public prop6: string | undefined;

            @Property(Set)
            public set1: Set<any> = new Set([1, 2, "3", true]);

            @Property(Map)
            public map1: Map<any, any> = new Map<any, any>([
                [1, "number1"],
                ["1", "string1"],
                [2, true],
                [3, new Date(2016, 10, 10, 10, 10, 10)]
            ]);
        }

        const a = new A();
        await manager.save(a);

        const res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("e:A:1:map1"),
            conn.client.smembersAsync("e:A:1:set1")
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Saves only changed properties", async () => {
        @Hash()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string | undefined = "abc";

            @Property(Date)
            public prop3: Date = new Date(2016, 10, 10, 10, 10, 10);

            @Property()
            public prop4: object = { a: "abc", d: 5 };

            @Property(String)
            public prop5: string | null = null;

            @Property(Set)
            public set1: Set<any> = new Set([1, 2, "3", true]);

            @Property(Map)
            public map1: Map<any, any> = new Map<any, any>([
                [1, "number1"],
                ["1", "string1"],
                [2, true],
                [3, new Date(2016, 10, 10, 10, 10, 10)]
            ]);
        }

        const a = new A();
        await manager.save(a);

        a.prop1 = undefined;
        a.prop3.setFullYear(2015);
        (a.prop4 as any).d = 8;
        a.prop5 = "abcdef";
        a.set1.add(4);
        a.set1.delete(1);
        a.map1.delete("1");
        a.map1.set(2, "number2");

        await monitor.clearMonitorCalls(100);
        await manager.save(a);
        await monitor.wait(100);
        expect(monitor.requests).toMatchSnapshot();
        const res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("e:A:1:map1"),
            conn.client.smembersAsync("e:A:1:set1")
        ]);
        expect(res).toMatchSnapshot();
    });
});