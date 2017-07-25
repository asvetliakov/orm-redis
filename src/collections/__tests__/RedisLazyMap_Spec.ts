import { RedisLazyMap } from "../../Collections/RedisLazyMap";
import { Connection } from "../../Connection/Connection";
import { Entity } from "../../Decorators/Entity";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { RedisManager } from "../../Persistence/RedisManager";
import { cleanRedisConnection, createRedisConnection } from "../../testutils/redis";
import { RedisTestMonitor } from "../../testutils/RedisTestMonitor";

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

describe("Size", () => {
    it("Returns size of map", async () => {
        await conn.client.hmsetAsync("myMap", {
            "i:1": "s:a",
            "i:2": "s:a",
            "i:3": "s:a",
            "i:4": "s:a",
            "i:5": "s:a",
        });
        const map = new RedisLazyMap("myMap", manager);
        expect(await map.size()).toBe(5);
    });
});

describe("Set", () => {
    it("Sets simple values for map", async () => {
        const map = new RedisLazyMap("myMap", manager);
        await map.set(1, "test");
        await map.set("1", 1);
        await map.set(2, true);
        await map.set(3, { a: true });

        const res = await conn.client.hgetallAsync("myMap");
        expect(res).toEqual({
            "i:1": "s:test",
            "s:1": "i:1",
            "i:2": "b:1",
            "i:3": "j:" + JSON.stringify({ a: true })
        });
    });

    it("Sets entities in map but doesn't save entities without cascade insert", async () => {
        @Entity()
        class Ent {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop: string = "prop";
        }

        const map = new RedisLazyMap<number, Ent>("myMap", manager, Ent, false);
        const ent1 = new Ent();
        ent1.id = 1;
        const ent2 = new Ent();
        ent2.id = 2;
        await map.set(1, ent1);
        await map.set(2, ent2);
        const mapRes = await conn.client.hgetallAsync("myMap");
        expect(mapRes).toEqual({
            "i:1": "e:Ent:1",
            "i:2": "e:Ent:2"
        });
        await map.set(3, ent2);
        const exists = await Promise.all([
            conn.client.existsAsync("e:Ent:1"),
            conn.client.existsAsync("e:Ent:2"),
        ]);
        expect(exists).toEqual([0, 0]);
    });

    it("Sets entities in map with cascade insert", async () => {
        @Entity()
        class Ent {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop: string = "prop";
        }

        const map = new RedisLazyMap<number, Ent>("myMap", manager, Ent, true);
        const ent1 = new Ent();
        ent1.id = 1;
        const ent2 = new Ent();
        ent2.id = 2;
        await map.set(1, ent1);
        await map.set(2, ent2);
        await map.set(3, ent2);

        const mapRes = await conn.client.hgetallAsync("myMap");
        expect(mapRes).toEqual({
            "i:1": "e:Ent:1",
            "i:2": "e:Ent:2",
            "i:3": "e:Ent:2",
        });
        let entRes = await conn.client.hgetallAsync("e:Ent:1");
        expect(entRes).toEqual({
            id: "i:1",
            prop: "s:prop"
        });
        entRes = await conn.client.hgetallAsync("e:Ent:2");
        expect(entRes).toEqual({
            id: "i:2",
            prop: "s:prop"
        });
    });
});

describe("Delete", () => {
    it("Deletes simple value by key", async () => {
        await conn.client.hmsetAsync("myMap", {
            "i:1": "s:a",
            "i:2": "s:a",
            "i:3": "s:a",
            "i:4": "s:a",
            "i:5": "s:a",
        });
        const map = new RedisLazyMap("myMap", manager);
        await map.delete(5);
        await map.delete(3);

        const res = await conn.client.hgetallAsync("myMap");
        expect(res).toEqual({
            "i:1": "s:a",
            "i:2": "s:a",
            "i:4": "s:a",
        });
    });

    it("Deletes entity by key without deleting entities", async () => {
        @Entity()
        class Ent {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop: string = "prop";
        }

        const map = new RedisLazyMap<number, Ent>("myMap", manager, Ent, true);
        const ent1 = new Ent();
        ent1.id = 1;
        const ent2 = new Ent();
        ent2.id = 2;
        await map.set(1, ent1);
        await map.set(2, ent2);
        await map.set(3, ent2);

        await map.delete(3);
        await map.delete(1);
        const res = await conn.client.hgetallAsync("myMap");
        expect(res).toEqual({
            "i:2": "e:Ent:2",
        });
        const exists = await Promise.all([
            conn.client.existsAsync("e:Ent:1"),
            conn.client.existsAsync("e:Ent:2"),
        ]);
        expect(exists).toEqual([1, 1]);
    });

    it("Deletes entity by key with deleting entity", async () => {
        @Entity()
        class Ent {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop: string = "prop";
        }

        const map = new RedisLazyMap<number, Ent>("myMap", manager, Ent, true);
        const ent1 = new Ent();
        ent1.id = 1;
        const ent2 = new Ent();
        ent2.id = 2;
        await map.set(1, ent1);
        await map.set(2, ent2);

        await map.delete(1, true);
        const res = await conn.client.hgetallAsync("myMap");
        expect(res).toEqual({
            "i:2": "e:Ent:2",
        });
        const exists = await Promise.all([
            conn.client.existsAsync("e:Ent:1"),
            conn.client.existsAsync("e:Ent:2"),
        ]);
        expect(exists).toEqual([0, 1]);
    });
});

describe("Has", () => {
    it("Checks by simple keys", async () => {
        await conn.client.hmsetAsync("myMap", {
            "i:1": "s:a",
            "s:test": "s:a",
            "i:3": "s:a",
            "i:4": "s:a",
            "s:5": "s:a",
        });
        const map = new RedisLazyMap("myMap", manager);
        expect(await map.has(1)).toBeTruthy();
        expect(await map.has(5)).toBeFalsy();
        expect(await map.has("5")).toBeTruthy();
        expect(await map.has("test")).toBeTruthy();
        expect(await map.has(3)).toBeTruthy();
    });

    it("Checks with entities", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }
        await conn.client.hmsetAsync("myMap", {
            "i:1": "e:A:1",
            "i:2": "e:A:2",
        });
        await conn.client.hmsetAsync("e:A:1", {
            id: "i:1"
        });
        const map = new RedisLazyMap<number, A>("myMap", manager, A);
        expect(await map.has(1)).toBeTruthy();
        // entity doesn't exist, so false
        expect(await map.has(2)).toBeFalsy();
    });
});

describe("Get", () => {
    it("Return simple values for simple map", async () => {
        await conn.client.hmsetAsync("myMap", {
            "i:1": "s:test",
            "s:test": "i:10",
            "i:3": "b:0",
            "s:5": "s:a",
        });
        const map = new RedisLazyMap("myMap", manager);
        expect(await map.get(1)).toBe("test");
        expect(await map.get("test")).toBe(10);
        expect(await map.get(3)).toBe(false);
        expect(await map.get("5")).toBe("a");
    });

    it("Returns entities for entity map", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }

        const map = new RedisLazyMap("myMap", manager, A);
        const a = new A();
        a.id = 1;
        // not saved
        const a2 = new A();
        a2.id = 2;
        await manager.save(a);

        await map.set(1, a);
        await map.set(2, a2);

        const ret1 = await map.get(1);
        expect(ret1).toBeInstanceOf(A);
        expect(ret1!.id).toBe(1);
        const ret2 = await map.get(2);
        expect(ret2).toBeUndefined();
    });
});

describe("Clear", () => {
    it("removes map", async () => {
        await conn.client.hmsetAsync("myMap", {
            "i:1": "s:test",
        });
        const map = new RedisLazyMap("myMap", manager);
        await map.clear();
        const res = await conn.client.existsAsync("myMap");
        expect(res).toBe(0);
    });

    it("removes map and entities if specified", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }

        const map = new RedisLazyMap("myMap", manager, A);
        const a = new A();
        a.id = 1;
        const a2 = new A();
        a2.id = 2;
        await manager.save(a);
        await manager.save(a2);

        await map.set(1, a);
        await map.set(2, a2);

        await map.clear();
        let res = await Promise.all([
            conn.client.existsAsync("myMap"),
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("e:A:2"),
        ]);
        expect(res).toEqual([0, 1, 1]);

        await map.set(1, a);
        await map.set(2, a2);
        await map.clear(true);
        res = await Promise.all([
            conn.client.existsAsync("myMap"),
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("e:A:2"),
        ]);
        expect(res).toEqual([0, 0, 0]);
    });
});

describe("toArray", () => {
    it("Returns array of map pairs", async () => {
        await conn.client.hmsetAsync("myMap", {
            "i:1": "s:a",
            "i:2": "s:a",
            "i:3": "s:a",
            "i:4": "s:a",
            "i:5": "s:a",
        });
        const map = new RedisLazyMap("myMap", manager);
        expect(await map.toArray()).toEqual([
            [1, "a"],
            [2, "a"],
            [3, "a"],
            [4, "a"],
            [5, "a"],
        ]);
    });
});

describe("Iterators", () => {
    it("Iterates over keys for simple map", async () => {
        await conn.client.hmsetAsync("myMap", {
            "i:1": "s:test",
            "s:test": "i:10",
            "i:3": "b:0",
            "s:5": "s:a",
        });
        const map = new RedisLazyMap("myMap", manager);

        const keys: any[] = [];
        for await (const key of map.keys()) {
            keys.push(key);
        }
        expect(keys).toEqual([1, "test", 3, "5"]);
    });

    it("Iterates over keys for entity map", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }
        const map = new RedisLazyMap("myMap", manager, A);
        const a1 = new A();
        a1.id = 1;
        const a2 = new A();
        a2.id = 1;
        await map.set(1, a1);
        await map.set("1", a2);

        const keys: any[] = [];
        for await (const key of map.keys()) {
            keys.push(key);
        }
        expect(keys).toEqual([1, "1"]);
    });

    it("Iterates over keys/values for simple map", async () => {
        await conn.client.hmsetAsync("myMap", {
            "i:1": "s:test",
            "s:test": "i:10",
            "i:3": "b:0",
            "s:5": "s:a",
        });
        const map = new RedisLazyMap("myMap", manager);
        const vals: any[] = [];
        for await (const val of map.values()) {
            vals.push(val);
        }
        expect(vals).toEqual(["test", 10, false, "a"]);

        const pairs: any[] = [];
        for await (const keyVal of map) {
            pairs.push(keyVal);
        }
        expect(pairs).toEqual([
            [1, "test"],
            ["test", 10],
            [3, false],
            ["5", "a"]
        ]);
    });

    it("Iterates over keys/values for entity map", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }
        const map = new RedisLazyMap<number, A>("myMap", manager, A, true);
        const a1 = new A();
        const a2 = new A();
        const a3 = new A();
        const a4 = new A();
        a1.id = 1;
        a2.id = 2;
        a3.id = 3;
        a4.id = 4;
        await map.set(1, a1);
        await map.set(2, a3);
        await map.set(3, a2);
        await map.set(4, a3);
        await map.set(5, a4);
        await map.set(6, a4);

        const vals: A[] = [];
        for await (const val of map.values()) {
            vals.push(val);
        }
        expect(vals).toHaveLength(6);
        expect(vals.map(val => val.id)).toEqual([1, 3, 2, 3, 4, 4]);
        expect(vals[0]).toBeInstanceOf(A);

        const pairs: Array<[number, A]> = [];
        for await (const keyVal of map) {
            pairs.push(keyVal);
        }
        expect(pairs.map(pair => [pair[0], pair[1].id])).toEqual([
            [1, 1],
            [2, 3],
            [3, 2],
            [4, 3],
            [5, 4],
            [6, 4]
        ]);
    });
});