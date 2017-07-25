import { Connection } from "../../Connection/Connection";
import { Entity } from "../../Decorators/Entity";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { RedisManager } from "../../Persistence/RedisManager";
import { cleanRedisConnection, createRedisConnection } from "../../testutils/redis";
import { RedisTestMonitor } from "../../testutils/RedisTestMonitor";
import { RedisLazySet } from "../RedisLazySet";

let conn: Connection;
let manager: RedisManager;
let monitor: RedisTestMonitor;
beforeAll(async () => {
    conn = await createRedisConnection();
    manager = conn.manager;
    monitor = await RedisTestMonitor.create(conn);

});

afterEach(async () => {
    await monitor.clearMonitorCalls(50);
    await conn.flushdb();
});

afterAll(async () => {
    await monitor.release();
    await cleanRedisConnection(conn);
});

describe("Add", () => {
    it("Add simple value", async () => {
        const set = new RedisLazySet("a:mySet", manager);
        let res = await conn.client.smembersAsync("a:mySet");
        expect(res).toEqual([]);

        await set.add(1);
        await set.add(true);
        await set.add("test");
        res = await conn.client.smembersAsync("a:mySet");
        expect(res).toEqual(expect.arrayContaining([
            "i:1",
            "b:1",
            "s:test"
        ]));
    });

    it("Add entity with/without cascade insert", async () => {
        @Entity()
        class Ent {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop: string = "test prop";
        }

        const set = new RedisLazySet<Ent>("a:mySet", manager, Ent);
        const ent1 = new Ent();
        ent1.id = 1;
        const ent2 = new Ent();
        ent2.id = 2;
        await set.add(ent1);
        await set.add(ent2);

        const setRes = await conn.client.smembersAsync("a:mySet");
        expect(setRes).toEqual(expect.arrayContaining([
            "e:Ent:1",
            "e:Ent:2"
        ]));
        const exists = await Promise.all([
            conn.client.existsAsync("e:Ent:1"),
            conn.client.existsAsync("e:Ent:2"),
        ]);
        expect(exists).toEqual([0, 0]);

        const set2 = new RedisLazySet<Ent>("a:set2", manager, Ent, true);
        await set2.add(ent1);
        await set2.add(ent2);
        const set2Res = await conn.client.smembersAsync("a:set2");
        expect(set2Res).toEqual(expect.arrayContaining([
            "e:Ent:1",
            "e:Ent:2"
        ]));
        const res = await Promise.all([
            conn.client.hgetallAsync("e:Ent:1"),
            conn.client.hgetallAsync("e:Ent:2"),
        ]);
        expect(res[0]).toEqual({
            id: "i:1",
            prop: "s:test prop",
        });
        expect(res[1]).toEqual({
            id: "i:2",
            prop: "s:test prop",
        });
    });
});

describe("Delete", () => {
    it("Delete simple value from set", async () => {
        await conn.client.saddAsync("a:mySet", "i:1", "i:2", "i:3");
        const set = new RedisLazySet("a:mySet", manager);
        await set.delete(1);
        await set.delete(2);
        await set.delete(10);

        const res = await conn.client.smembersAsync("a:mySet");
        expect(res).toEqual(["i:3"]);
    });

    it("Deletes entity from set and entity itself if requested", async () => {
        @Entity()
        class Ent {
            @IdentifyProperty()
            public id: number;
        }
        const set = new RedisLazySet<Ent>("a:mySet", manager, Ent, true);
        const ent1 = new Ent();
        ent1.id = 1;
        const ent2 = new Ent();
        ent2.id = 2;

        await set.add(ent1);
        await set.add(ent2);

        let setRes = await conn.client.smembersAsync("a:mySet");
        expect(setRes).toEqual(expect.arrayContaining([
            "e:Ent:1",
            "e:Ent:2"
        ]));

        await set.delete(ent2);
        setRes = await conn.client.smembersAsync("a:mySet");
        expect(setRes).toEqual([
            "e:Ent:1",
        ]);
        const ent2Res = await conn.client.existsAsync("e:Ent:2");
        expect(ent2Res).toBe(1);
        await set.delete(ent1, true);
        const ent1Res = await conn.client.existsAsync("e:Ent:1");
        expect(ent1Res).toBe(0);
    });
});

describe("Has", () => {
    it("Checks for existence of simple value", async () => {
        await conn.client.saddAsync("a:mySet", "i:1", "i:2", "i:3");
        const set = new RedisLazySet("a:mySet", manager);
        expect(await set.has(1)).toBeTruthy();
        expect(await set.has(2)).toBeTruthy();
        expect(await set.has("2")).toBeFalsy();
        expect(await set.has(10)).toBeFalsy();
    });

    it("Checks for existence of entity", async () => {
        @Entity()
        class Ent {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop: string = "test prop";
        }
        const set = new RedisLazySet<Ent>("a:mySet", manager, Ent);
        const ent1 = new Ent();
        ent1.id = 1;
        const ent2 = new Ent();
        ent2.id = 2;
        const ent3 = new Ent();
        ent3.id = 3;
        await set.add(ent1);
        await set.add(ent2);
        await manager.save(ent3);

        expect(await set.has(ent1)).toBeTruthy();
        expect(await set.has(ent2)).toBeTruthy();
        expect(await set.has(ent3)).toBeFalsy();
    });
});

describe("Size", () => {
    it("Returns set size", async () => {
        await conn.client.saddAsync("a:mySet", "i:1", "i:2", "i:3");
        const set = new RedisLazySet("a:mySet", manager);
        expect(await set.size()).toBe(3);
    });
});

describe("clear", () => {
    it("Deletes simple set", async () => {
        const set = new RedisLazySet("a:mySet", manager);

        await set.add(1);
        await set.add(true);
        await set.add("test");
        await set.clear();
        const res = await conn.client.smembersAsync("a:mySet");
        expect(res).toEqual([]);
    });

    it("Deletes entity set with entities if requested", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }

        const set1 = new RedisLazySet("a:mySet", manager, A, true);
        const set2 = new RedisLazySet("a:mySet2", manager, A, true);
        const a1 = new A();
        a1.id = 1;
        const a2 = new A();
        a2.id = 2;
        const a3 = new A();
        a3.id = 3;
        const a4 = new A();
        a4.id = 4;

        await set1.add(a1);
        await set1.add(a2);

        await set2.add(a3);
        await set2.add(a4);

        await set1.clear();
        await set2.clear(true);
        
        const setsExists = await Promise.all([
            conn.client.existsAsync("a:mySet"),
            conn.client.existsAsync("a:mySet2"),
        ]);
        expect(setsExists).toEqual([0, 0]);

        const aExists = await Promise.all([
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("e:A:2"),
            conn.client.existsAsync("e:A:3"),
            conn.client.existsAsync("e:A:4"),
        ]);
        expect(aExists).toEqual([1, 1, 0, 0]);
    });
});

describe("Values", () => {
    it("Iterates over simple set values", async () => {
        const prefill: number[] = [];
        for (let i = 0; i < 1000; i++) {
            prefill.push(i);
        }
        await conn.client.saddAsync("a:mySet", prefill.map(val => `i:${val}`));
        const set = new RedisLazySet<number>("a:mySet", manager);

        await monitor.clearMonitorCalls(150);

        const gettedValues: number[] = [];

        for await (const val of set.values()) {
            expect(typeof val).toBe("number");
            gettedValues.push(val);
        }

        expect(gettedValues).toHaveLength(1000);
        expect(gettedValues).toEqual(expect.arrayContaining(prefill));
        await monitor.wait(100);
        // req[0] is sscan
        // req[1] is a:mySet
        expect(monitor.requests.map(req => [req[0], [req[1]]]).length).toBeGreaterThan(10);
    });

    it("Iterates over entities", async () => {
        @Entity()
        class Ent {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop: string = "test prop";
        }
        const idsInSet: string[] = [];
        for (let i = 0; i < 50; i++) {
            const ent = new Ent();
            ent.id = i;
            await manager.save(ent);
            idsInSet.push(`e:Ent:${i}`);
        }
        await conn.client.saddAsync("a:mySet", idsInSet);
        const set = new RedisLazySet<Ent>("a:mySet", manager, Ent);

        await monitor.clearMonitorCalls(150);
        const entites: Ent[] = [];
        for await (const val of set.values()) {
            entites.push(val);
        }
        expect(entites).toHaveLength(50);
        expect(entites[0]).toBeInstanceOf(Ent);
        expect(entites.map(ent => ent.id)).toEqual(expect.arrayContaining([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
            30, 40, 41, 42, 43, 44, 45, 49 
        ]));
        await monitor.wait(100);
        // req[0] is sscan
        // req[1] is a:mySet
        expect(monitor.requests.map(req => [req[0], [req[1]]]).length).toBeGreaterThan(10);
    });
});