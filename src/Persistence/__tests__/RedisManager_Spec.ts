import { Connection } from "../../Connection/Connection";
import { Hash } from "../../Decorators/Hash";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { cleanRedisConnection, createRedisConnection } from "../../testutils/redis";
import { RedisManager } from "../RedisManager";

let conn: Connection;
let manager: RedisManager;
beforeAll(async () => {
    conn = await createRedisConnection();
    manager = conn.manager;
});

afterEach(async () => {
    await conn.flushdb();
});

afterAll(async () => {
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
});