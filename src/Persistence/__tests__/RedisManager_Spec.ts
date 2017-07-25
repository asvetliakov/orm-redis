import { Connection } from "../../Connection/Connection";
import { Entity } from "../../Decorators/Entity";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { RelationProperty } from "../../Decorators/RelationProperty";
import { EntitySubscriberInterface } from "../../Subscriber/EntitySubscriberInterface";
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
        @Entity()
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
            conn.client.hgetallAsync("m:e:A:1:map1"),
        ]);
        const set = await conn.client.smembersAsync("a:e:A:1:set1");
        expect(set).toContainEqual("b:1");
        expect(set).toContainEqual("i:1");
        expect(set).toContainEqual("s:3");
        expect(set).toContainEqual("i:2");
        expect(res).toMatchSnapshot();
    });

    it("Saves only changed properties", async () => {
        @Entity()
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
        let res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("m:e:A:1:map1"),
        ]);
        let set = await conn.client.smembersAsync("a:e:A:1:set1");
        expect(res).toMatchSnapshot();
        expect(set).toContainEqual("i:4");
        expect(set).toContainEqual("s:3");
        expect(set).toContainEqual("b:1");
        expect(set).toContainEqual("i:2");

        await monitor.clearMonitorCalls(100);
        a.set1.clear();
        a.map1 = new Map<any, any>();
        await manager.save(a);
        await monitor.wait(100);
        expect(monitor.requests).toMatchSnapshot();
        res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("m:e:A:1:map1"),
        ]);
        set = await conn.client.smembersAsync("a:e:A:1:set1");
        expect(set).toEqual([]);
        expect(res).toMatchSnapshot();
    });

    it("Doesn't send change requests if there are no any changes", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "abc";

            @Property(Map)
            public set: Map<any, any> = new Map<any, any>([
                [1, "a"],
                [2, "b"]
            ]);
        }
        const a = new A();
        await manager.save(a);
        await monitor.clearMonitorCalls(100);
        await manager.save(a);
        await monitor.wait(100);
        expect(monitor.requests).toHaveLength(0);
    });

    it("Saves single relation without cascade inserting", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "rel";
        }
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @RelationProperty(type => Rel)
            public rel: Rel = new Rel();
        }
        const a = new A();
        await manager.save(a);
        const res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("e:Rel:1"),
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Saves single relation with cascade inserting", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "rel";
        }
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @RelationProperty(type => Rel, { cascadeInsert: true })
            public rel: Rel = new Rel();
        }
        const a = new A();
        await manager.save(a);
        const res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("e:Rel:1"),
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Saves cyclic relation with cascade inserting", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "I'm a";

            public b: B;
        }
        @Entity()
        class B {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "I'm b";

            public a: A;
        }
        const a = new A();
        const b = new B();
        RelationProperty(type => [B, B], { cascadeInsert: true })(a, "b");
        RelationProperty(type => [A, A], { cascadeInsert: true })(b, "a");
        a.b = b;
        b.a = a;
        await manager.save(a);
        const res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("e:B:1"),
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Updates single relation with with cascade updating", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "abc";
        }

        @Entity()
        class B {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "b string";

            @RelationProperty(type => A, { cascadeInsert: true, cascadeUpdate: true })
            public a: A = new A();
        }

        const b = new B();
        await manager.save(b);

        await monitor.clearMonitorCalls(100);
        b.a.prop1 = "cde";
        await manager.save(b);
        await monitor.wait(100);
        expect(monitor.requests).toMatchSnapshot();
        const res = await conn.client.hgetallAsync("e:A:1");
        expect(res).toMatchSnapshot();
    });

    it("Doesn't update single relation without cascade update", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "abc";
        }

        @Entity()
        class B {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "b string";

            @RelationProperty(type => A, { cascadeInsert: true, cascadeUpdate: false })
            public a: A = new A();
        }

        const b = new B();
        await manager.save(b);

        await monitor.clearMonitorCalls(100);
        b.a.prop1 = "cde";
        await manager.save(b);
        await monitor.wait(100);
        expect(monitor.requests).toMatchSnapshot();
        const res = await conn.client.hgetallAsync("e:A:1");
        expect(res).toMatchSnapshot();
    });

    it("Doesn't touch relation if it was skipped for loading", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "abc";
        }

        @Entity()
        class B {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "b string";

            @RelationProperty(type => A, { cascadeInsert: true, cascadeUpdate: false })
            public a: A = new A();
        }

        const b = new B();
        await manager.save(b);

        const b2 = await manager.load(B, 1, ["a"]);
        b2!.a.prop1 = "def";
        await manager.save(b2!);

        const res = await conn.client.hgetallAsync("e:A:1");
        expect(res).toMatchSnapshot();
    });

    it("Saves only links to multiple relations without cascade insert", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: string = "1";

            @RelationProperty(type => [Rel, Set])
            public mySet: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Map])
            public myMap: Map<number, Rel> = new Map();
        }

        const a = new A();
        const rel1 = new Rel();
        rel1.id = 1;
        rel1.prop1 = "uno";
        const rel2 = new Rel();
        rel2.id = 2;
        rel2.prop1 = "dos";
        const rel3 = new Rel();
        rel3.id = 3;
        rel3.prop1 = "tres";
        const rel4 = new Rel();
        rel4.id = 4;
        rel4.prop1 = "cuatro";

        a.mySet.add(rel1);
        a.mySet.add(rel2);
        a.myMap.set(1, rel3);
        a.myMap.set(2, rel4);

        await manager.save(a);
        const res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.smembersAsync("a:e:A:1:mySet"),
            conn.client.hgetallAsync("m:e:A:1:myMap"),
            conn.client.hgetallAsync("e:Rel:1"),
            conn.client.hgetallAsync("e:Rel:2"),
            conn.client.hgetallAsync("e:Rel:3"),
            conn.client.hgetallAsync("e:Rel:4"),
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Saves multiple relations with cascade insert", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: string = "1";

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
            public mySet: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
            public myMap: Map<number, Rel> = new Map();
        }

        const a = new A();
        const rel1 = new Rel();
        rel1.id = 1;
        rel1.prop1 = "uno";
        const rel2 = new Rel();
        rel2.id = 2;
        rel2.prop1 = "dos";
        const rel3 = new Rel();
        rel3.id = 3;
        rel3.prop1 = "tres";
        const rel4 = new Rel();
        rel4.id = 4;
        rel4.prop1 = "cuatro";

        a.mySet.add(rel1);
        a.mySet.add(rel2);
        a.myMap.set(1, rel3);
        a.myMap.set(2, rel4);

        await manager.save(a);
        const res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.smembersAsync("a:e:A:1:mySet"),
            conn.client.hgetallAsync("m:e:A:1:myMap"),
            conn.client.hgetallAsync("e:Rel:1"),
            conn.client.hgetallAsync("e:Rel:2"),
            conn.client.hgetallAsync("e:Rel:3"),
            conn.client.hgetallAsync("e:Rel:4"),
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Saves multiple cyclic relations with cascade insert", async () => {
        @Entity()
        class AnotherRel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop2: boolean;

            public a: A;
        }
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;

            @RelationProperty(type => [AnotherRel, AnotherRel], { cascadeInsert: true })
            public rel2: AnotherRel;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: string = "1";

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
            public mySet: Set<Rel> = new Set();

            @RelationProperty(type => [AnotherRel, Map], { cascadeInsert: true })
            public myMap: Map<number, AnotherRel> = new Map();
        }

        const a = new A();
        const anotherRel1 = new AnotherRel();
        RelationProperty(type => [A, A], { cascadeInsert: true })(anotherRel1, "a");
        anotherRel1.id = 1;
        anotherRel1.a = a;
        const anotherRel2 = new AnotherRel();
        RelationProperty(type => [A, A], { cascadeInsert: true })(anotherRel2, "a");
        anotherRel2.id = 2;
        anotherRel2.a = a;

        const rel1 = new Rel();
        rel1.id = 1;
        rel1.prop1 = "uno";
        rel1.rel2 = anotherRel1;
        const rel2 = new Rel();
        rel2.id = 2;
        rel2.prop1 = "dos";
        rel2.rel2 = anotherRel1;
        const rel3 = new Rel();
        rel3.id = 3;
        rel3.prop1 = "tres";
        rel3.rel2 = anotherRel2;
        const rel4 = new Rel();
        rel4.id = 4;
        rel4.prop1 = "cuatro";
        rel4.rel2 = anotherRel2;

        a.mySet.add(rel1);
        a.mySet.add(rel2);
        a.mySet.add(rel3);
        a.mySet.add(rel4);
        a.myMap.set(1, anotherRel1);
        a.myMap.set(2, anotherRel2);

        await manager.save(a);
        const res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("m:e:A:1:myMap"),
            conn.client.hgetallAsync("e:Rel:1"),
            conn.client.hgetallAsync("e:Rel:2"),
            conn.client.hgetallAsync("e:Rel:3"),
            conn.client.hgetallAsync("e:Rel:4"),
            conn.client.hgetallAsync("e:AnotherRel:1"),
            conn.client.hgetallAsync("e:AnotherRel:2"),
        ]);
        const set = await conn.client.smembersAsync("a:e:A:1:mySet");
        expect(set).toEqual(expect.arrayContaining([
            "e:Rel:3", "e:Rel:4", "e:Rel:2", "e:Rel:1"
        ]));
        expect(res).toMatchSnapshot();
    });

    it("Updates relations in maps/sets with cascade update", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: string = "1";

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true, cascadeUpdate: true })
            public mySet: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Map], { cascadeInsert: true, cascadeUpdate: true })
            public myMap: Map<number, Rel> | undefined = new Map();
        }
        const a = new A();
        const rel1 = new Rel();
        rel1.id = 1;
        rel1.prop1 = "test";
        const rel2 = new Rel();
        rel2.id = 2;
        rel2.prop1 = "test2";
        a.mySet.add(rel1).add(rel2);
        a.myMap!.set(1, rel1).set(2, rel2);

        await manager.save(a);
        await monitor.clearMonitorCalls(100);

        rel1.prop1 = "new test";
        a.myMap = undefined;
        await manager.save(a);
        await monitor.wait(100);
        expect(monitor.requests).toMatchSnapshot();

        const res = await conn.client.hgetallAsync("e:Rel:1");
        expect(res).toMatchSnapshot();
    });

    it("Doesn't update relations in maps/sets without cascade update", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: string = "1";

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true, cascadeUpdate: false })
            public mySet: Set<Rel> = new Set();
        }
        const a = new A();
        const rel1 = new Rel();
        rel1.id = 1;
        rel1.prop1 = "test";
        a.mySet.add(rel1);

        await manager.save(a);
        await monitor.clearMonitorCalls(100);

        rel1.prop1 = "new test";
        await manager.save(a);
        await monitor.wait(100);
        expect(monitor.requests).toHaveLength(0);
        const res = await conn.client.hgetallAsync("e:Rel:1");
        expect(res).toMatchSnapshot();
    });

    it("Doesn't delete relations in maps and sets if skipped them for loading", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: string = "1";

            @RelationProperty(type => [Rel, Map], { cascadeInsert: true, cascadeUpdate: false })
            public map: Map<number, Rel> = new Map();
        }
        const a = new A();
        const rel1 = new Rel();
        rel1.id = 1;
        rel1.prop1 = "test";
        const rel2 = new Rel();
        rel2.id = 2;
        rel2.prop1 = "test2";
        a.map.set(1, rel1);
        a.map.set(2, rel2);

        await manager.save(a);

        const a2 = await manager.load(A, 1, ["map"]);
        if (!a2) { throw new Error(); }
        a2.map.clear();
        await manager.save(a2);

        const res = await conn.client.hgetallAsync("m:e:A:1:map");
        expect(res).toMatchSnapshot();
    });
});

describe("Remove", () => {
    it("Removes entity", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "abc";

            @Property(Set)
            public set: Set<any> = new Set([1, 2, 3]);

            @Property(Map)
            public map: Map<number, any> = new Map([
                [1, "uno"],
                [2, "dos"]
            ]);
        }

        const a = new A();
        await manager.save(a);

        let res: any = await conn.client.hgetallAsync("e:A:1");
        expect(res.id).toBe("i:1");
        await manager.remove(a);
        res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("m:e:A:1:map"),
            conn.client.smembersAsync("a:e:A:1:set"),
        ]);
        expect(res).toMatchSnapshot();

        // can be saved again after removing
        await manager.save(a);
        res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("m:e:A:1:map"),
        ]);
        const set = await conn.client.smembersAsync("a:e:A:1:set");
        expect(set).toEqual(expect.arrayContaining(["i:3", "i:1", "i:2"]));
        expect(res).toMatchSnapshot();
    });

    it("Doesn't remove relations", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @RelationProperty(type => Rel, { cascadeInsert: true })
            public singleRel: Rel;

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
            public setRel: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
            public mapRel: Map<number, Rel> = new Map();
        }

        const a = new A();
        const rel1 = new Rel();
        rel1.id = 1;
        const rel2 = new Rel();
        rel2.id = 2;
        a.singleRel = rel1;
        a.setRel.add(rel1);
        a.mapRel.set(1, rel1).set(2, rel2);

        await manager.save(a);
        let res: any = await Promise.all([
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("a:e:A:1:setRel"),
            conn.client.existsAsync("m:e:A:1:mapRel"),
            conn.client.existsAsync("e:Rel:1"),
            conn.client.existsAsync("e:Rel:2"),
        ]);
        expect(res).toEqual([1, 1, 1, 1, 1]);
        await manager.remove(a);
        res = await Promise.all([
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("a:e:A:1:setRel"),
            conn.client.existsAsync("m:e:A:1:mapRel"),
            conn.client.existsAsync("e:Rel:1"),
            conn.client.existsAsync("e:Rel:2"),
        ]);
        expect(res).toEqual([0, 0, 0, 1, 1]);
    });

    it("Deletes relation sets/maps even if relations weren't loaded", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
            public setRel: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
            public mapRel: Map<number, Rel> = new Map();
        }

        const a = new A();
        const rel1 = new Rel();
        rel1.id = 1;
        const rel2 = new Rel();
        rel2.id = 2;
        a.setRel.add(rel1);
        a.mapRel.set(1, rel1).set(2, rel2);

        await manager.save(a);

        const a2 = await manager.load(A, 1, ["setRel", "mapRel"]);
        await manager.remove(a2!);

        const res = await Promise.all([
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("a:e:A:1:setRel"),
            conn.client.existsAsync("m:e:A:1:mapRel"),
        ]);
        expect(res).toEqual([0, 0, 0]);
    });

    it("Deletes entity by given class and id", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property(Map)
            public map: Map<any, any> = new Map([[1, "test"]]);

            @Property(Set)
            public set: Set<any> = new Set([1, 2]);
        }

        const a = new A();
        await manager.save(a);

        let res = await Promise.all([
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("m:e:A:1:map"),
            conn.client.existsAsync("a:e:A:1:set"),
        ]);
        expect(res).toEqual([1, 1, 1]);
        await manager.removeById(A, 1);
        res = await Promise.all([
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("m:e:A:1:map"),
            conn.client.existsAsync("a:e:A:1:set"),
        ]);
        expect(res).toEqual([0, 0, 0]);
    });

    it("Deletes many entities by id", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }

        const a1 = new A();
        a1.id = 1;
        const a2 = new A();
        a2.id = 2;
        const a3 = new A();
        a3.id = 3;
        await manager.save(a1);
        await manager.save(a2);
        await manager.save(a3);

        let res = await Promise.all([
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("e:A:2"),
            conn.client.existsAsync("e:A:3"),
        ]);
        expect(res).toEqual([1, 1, 1]);

        await manager.removeById(A, [1, 2, 3]);
        res = await Promise.all([
            conn.client.existsAsync("e:A:1"),
            conn.client.existsAsync("e:A:2"),
            conn.client.existsAsync("e:A:3"),
        ]);
        expect(res).toEqual([0, 0, 0]);
    });
});

describe("Load", () => {
    it("Loads simple entity without relations", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: number;

            @Property("myProp2")
            public prop2: string;

            @Property()
            public prop3: boolean;

            @Property()
            public prop4: Date;

            @Property()
            public prop5: object;

            @Property()
            public prop6: any[];

            @Property(String)
            public prop7: string | null;

            @Property(Number)
            public prop8: number | undefined;

            public prop9: string;

            @Property(Set)
            public set1: Set<string> = new Set();

            @Property(Map)
            public map1: Map<number | string, string> = new Map();

            @Property(Set)
            public set2: Set<string>;

            @Property(Map)
            public map2: Map<string, number>;
        }
        const a = new A();
        a.id = 2;
        a.prop1 = 10;
        a.prop2 = "prop2 str";
        a.prop3 = true;
        a.prop4 = new Date(Date.UTC(2016, 10, 10, 10, 10, 10));
        a.prop5 = { a: true, b: "str", c: 10 };
        a.prop6 = ["abc", "def", 5];
        a.prop7 = null;
        a.prop8 = undefined;
        a.prop9 = "non prop";
        a.set1.add("test").add("test2");
        a.map1.set(1, "test").set(2, "test2").set("1", "test3");

        await manager.save(a);

        const b = await manager.load(A, 2);
        if (!b) {
            throw new Error();
        }
        expect(b).toBeInstanceOf(A);
        expect(b.id).toBe(2);
        expect(b.prop1).toBe(10);
        expect(b.prop2).toBe("prop2 str");
        expect(b.prop3).toBeTruthy();
        expect(typeof b.prop3).toBe("boolean");
        expect(b.prop4.getTime()).toBe(new Date(Date.UTC(2016, 10, 10, 10, 10, 10)).getTime());
        expect(b.prop5).toEqual({ a: true, b: "str", c: 10 });
        expect(b.prop6).toEqual(["abc", "def", 5]);
        expect(b.prop7).toBeNull();
        expect(b.prop8).toBeUndefined();
        expect(b.prop9).toBeUndefined();
        expect(b.set1.has("test")).toBeTruthy();
        expect(b.set1.has("test2")).toBeTruthy();
        expect(b.map1.get(1)).toBe("test");
        expect(b.map1.get(2)).toBe("test2");
        expect(b.map1.get("1")).toBe("test3");
        expect(b.map2).toBeUndefined();
        expect(b.set2).toBeUndefined();

        // nonexist
        const c = await manager.load(A, 1);
        expect(c).toBeUndefined();
    });

    it("Must not set default initialized set or map to undefined", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property(Set)
            public set1: Set<any> = new Set();

            @Property(Map)
            public map1: Map<any, any> = new Map();
        }

        const a = new A();
        a.id = 1;
        await manager.save(a);

        const b = await manager.load(A, 1);
        expect(b!.map1).toBeDefined();
        expect(b!.set1).toBeDefined();

        a.set1.add("test");
        a.map1.set(1, "test2");
        await manager.save(a);

        const existsMap = await conn.client.existsAsync("m:e:A:1:map1");
        const existsSet = await conn.client.existsAsync("a:e:A:1:set1");
        expect(existsMap).toBeTruthy();
        expect(existsSet).toBeTruthy();

        await conn.client.delAsync("a:e:A:1:set1");
        await conn.client.delAsync("m:e:A:1:map1");
        
        const c = await manager.load(A, 1);
        expect(c!.map1).toBeDefined();
        expect(c!.set1).toBeDefined();
    });

    it("Must not set default undefined set or map to new map/set if undefined", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property(Set)
            public set1: Set<any>;

            @Property(Map)
            public map1: Map<any, any>;
        }

        const a = new A();
        a.id = 1;
        await manager.save(a);

        const b = await manager.load(A, 1);
        expect(b!.map1).toBeUndefined();
        expect(b!.set1).toBeUndefined();

        a.set1 = new Set(["test"]);
        a.map1 = new Map([[1, "test2"]]);
        await manager.save(a);

        const existsMap = await conn.client.existsAsync("m:e:A:1:map1");
        const existsSet = await conn.client.existsAsync("a:e:A:1:set1");
        expect(existsMap).toBeTruthy();
        expect(existsSet).toBeTruthy();

        await conn.client.delAsync("a:e:A:1:set1");
        await conn.client.delAsync("m:e:A:1:map1");
        
        const c = await manager.load(A, 1);
        expect(c!.map1).toBeUndefined();
        expect(c!.set1).toBeUndefined();
    });

    it("Loads multiple entities", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop: string;
        }
        const a1 = new A();
        a1.id = 1;
        a1.prop = "uno";
        const a2 = new A();
        a2.id = 2;
        a2.prop = "dos";

        await manager.save(a1);
        await manager.save(a2);

        const ents = await manager.load(A, [1, 3, 2]);
        expect(ents).toHaveLength(2);
        expect(ents![0]).toBeInstanceOf(A);
        expect(ents![0].id).toBe(1);
        expect(ents![1]).toBeInstanceOf(A);
        expect(ents![1].id).toBe(2);
    });

    it("Loads single relation", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;
            @Property()
            public relProp: string;
        }
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
            @RelationProperty(type => Rel, { cascadeInsert: true })
            public rel: Rel;
        }

        const a = new A();
        a.id = 1;
        a.rel = new Rel();
        a.rel.id = 1;
        a.rel.relProp = "test";

        await manager.save(a);

        const b = await manager.load(A, 1);
        expect(b!.id).toBe(1);
        expect(b!.rel.id).toBe(1);
        expect(b!.rel.relProp).toBe("test");
    });

    it("Loads circular referenced relations", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            public b: B;
        }
        @Entity()
        class B {
            @IdentifyProperty()
            public id: number;

            public a: A;
        }

        const a = new A();
        const b = new B();
        a.id = 1;
        a.b = b;
        b.id = 2;
        b.a = a;
        RelationProperty(type => [B, B])(a, "b");
        RelationProperty(type => [A, A])(b, "a");
        await manager.save(a);
        await manager.save(b);

        const c = await manager.load(A, 1);
        expect(c!.id).toBe(1);
        expect(c!.b.id).toBe(2);
        expect(c!.b.a).toBe(c);
    });

    it("Loads relations in sets and maps", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
            public set: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
            public map: Map<number, Rel> = new Map();
        }

        const rel1 = new Rel();
        rel1.id = 1;
        const rel2 = new Rel();
        rel2.id = 2;
        const rel3 = new Rel();
        rel3.id = 3;
        const rel4 = new Rel();
        rel4.id = 4;

        const a = new A();
        a.id = 1;
        a.set.add(rel1);
        a.set.add(rel2);
        a.map.set(1, rel1);
        a.map.set(2, rel2);
        a.map.set(3, rel3);
        a.map.set(4, rel4);

        await manager.save(a);
        const b = await manager.load(A, 1);
        if (!b) { throw new Error(); }
        expect(b.set.size).toBe(2);
        expect([...b.set.values()].map(v => v.id)).toEqual(expect.arrayContaining([1, 2]));
        expect(b.map.size).toEqual(4);
        expect(b.map.get(1)!.id).toBe(1);
        expect(b.map.get(2)!.id).toBe(2);
        expect(b.map.get(3)!.id).toBe(3);
        expect(b.map.get(4)!.id).toBe(4);
    });

    it("Loads deep relations", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }

        @Entity()
        class B {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => A, { cascadeInsert: true })
            public relA: A;
        }

        @Entity()
        class C {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => B, { cascadeInsert: true })
            public bRel: B;

            @RelationProperty(type => [B, Map], { cascadeInsert: true })
            public bMap: Map<number, B> = new Map();
        }

        const a1 = new A();
        a1.id = 1;
        const a2 = new A();
        a2.id = 2;

        const b1 = new B();
        b1.id = 1;
        b1.relA = a1;
        const b2 = new B();
        b2.id = 2;
        b2.relA = a2;
        const b3 = new B();
        b3.id = 3;
        b3.relA = a2;

        const c = new C();
        c.id = 1;
        c.bRel = b3;
        c.bMap.set(1, b1);
        c.bMap.set(2, b2);

        await manager.save(c);

        const res = await manager.load(C, 1);
        if (!res) { throw new Error(); }
        expect(res.id).toBe(1);
        expect(res.bRel.id).toBe(3);
        expect(res.bRel.relA.id).toBe(2);
        expect(res.bMap.get(1)!.id).toBe(1);
        expect(res.bMap.get(1)!.relA.id).toBe(1);
        expect(res.bMap.get(2)!.id).toBe(2);
        expect(res.bMap.get(2)!.relA.id).toBe(2);
        expect(res.bMap.get(2)!.relA).toBe(res.bRel.relA);
    });

    it("Skips relations from loading", async () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }

        const rel1 = new Rel();
        rel1.id = 1;
        const rel2 = new Rel();
        rel2.id = 2;
        const rel3 = new Rel();
        rel3.id = 3;
        const rel4 = new Rel();
        rel4.id = 4;
        const rel5 = new Rel();
        rel5.id = 5;
        const rel6 = new Rel();
        rel6.id = 6;

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => Rel, { cascadeInsert: true })
            public rel1: Rel;

            @RelationProperty(type => Rel, { cascadeInsert: true })
            public rel2: Rel;

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
            public relSet: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
            public relSet2: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
            public relMap: Map<number, Rel> = new Map();

            @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
            public relMap2: Map<number, Rel> = new Map();
        }

        const a = new A();
        a.id = 1;
        a.rel1 = rel1;
        a.rel2 = rel2;
        a.relSet.add(rel3);
        a.relSet2.add(rel4);
        a.relMap.set(1, rel5);
        a.relMap2.set(1, rel6);

        await manager.save(a);

        const b = await manager.load(A, 1, ["rel1", "relSet", "relMap"]);
        if (!b) { throw new Error(); }
        expect(b.id).toBe(1);
        expect(b.rel1).toBeUndefined();
        expect(b.rel2.id).toBe(2);
        expect(b.relSet.size).toBe(0);
        expect(b.relSet2.size).toBe(1);
        expect([...b.relSet2.values()].map(v => v.id)).toEqual([4]);
        expect(b.relMap.size).toBe(0);
        expect(b.relMap2.size).toBe(1);
        expect(b.relMap2.get(1)!.id).toBe(6);
    });
});

describe("Runs entity subscribers", () => {
    it("On save/update", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: number = 10;
        }

        @Entity()
        class B {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "abc";

            @RelationProperty(type => [A, A], { cascadeInsert: true, cascadeUpdate: true })
            public a: A = new A();

            @RelationProperty(type => [A, Set], { cascadeInsert: true, cascadeUpdate: true })
            public set: Set<A> = new Set();

            @RelationProperty(type => [A, Map], { cascadeInsert: true, cascadeUpdate: true })
            public map: Map<number, A> = new Map();
        }

        const sub1: EntitySubscriberInterface<A> = {
            listenTo: () => A,
            beforeSave: jest.fn(),
            afterSave: jest.fn()
        };
        const sub2: EntitySubscriberInterface<B> = {
            listenTo: () => B,
            beforeSave: jest.fn()
        };
        const manager = new RedisManager(conn, [sub1, sub2]);
        const b = new B();
        const a2 = new A();
        a2.id = 2;
        const a3 = new A();
        a3.id = 3;
        b.set.add(a2);
        b.map.set(1, a3);

        await manager.save(b);
        expect(sub1.beforeSave).toBeCalledWith(b.a);
        expect(sub1.beforeSave).toBeCalledWith(a2);
        expect(sub1.beforeSave).toBeCalledWith(a3);
        expect(sub1.afterSave).toBeCalledWith(b.a);
        expect(sub1.afterSave).toBeCalledWith(a2);
        expect(sub1.afterSave).toBeCalledWith(a3);
        expect(sub2.beforeSave).toBeCalledWith(b);

        sub1.beforeSave = jest.fn();
        sub1.afterSave = jest.fn();
        b.a.prop = 40;
        a3.prop = 450;
        await manager.save(b);
        expect(sub1.beforeSave).toBeCalledWith(b.a);
        expect(sub1.afterSave).toBeCalledWith(b.a);
        expect(sub1.beforeSave).toBeCalledWith(a3);
        expect(sub1.afterSave).toBeCalledWith(a3);
        // beforeSave() is always being called regardless of pending changes
        expect(sub1.beforeSave).toBeCalledWith(a2);
        // No persistence changes for a2
        expect(sub1.afterSave).not.toBeCalledWith(a2);
        expect(sub2.beforeSave).toHaveBeenCalledTimes(2);
    });

    it("Doesn't call beforeSave/afterSave subscribers for non cascade deep relations", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: number = 10;
        }

        @Entity()
        class B {
            @IdentifyProperty()
            public id: number = 1;

            @RelationProperty(type => A)
            public prop1: A = new A();

        }

        const sub1: EntitySubscriberInterface<A> = {
            listenTo: () => A,
            beforeSave: jest.fn(),
            afterSave: jest.fn()
        };
        const sub2: EntitySubscriberInterface<B> = {
            listenTo: () => B,
            beforeSave: jest.fn()
        };
        const manager = new RedisManager(conn, [sub1, sub2]);
        const b = new B();

        await manager.save(b);
        expect(sub1.beforeSave).not.toBeCalled();
        expect(sub1.afterSave).not.toBeCalled();
    });

    describe("On delete", () => {
        it("Calls beforeRemove/afterRemove methods for entity", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;
            }

            const sub: EntitySubscriberInterface<A> = {
                listenTo: () => A,
                beforeRemove: jest.fn(),
                afterRemove: jest.fn()
            };
            const manager = new RedisManager(conn, [sub]);
            const a = new A();
            await manager.save(a);
            await manager.remove(a);
            expect(sub.beforeRemove).toBeCalledWith(a);
            expect(sub.afterRemove).toBeCalledWith(a);
        });

        it("Doesn't call for any relations", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;
            }
            const rel1 = new Rel();
            const rel2 = new Rel();
            const rel3 = new Rel();
            rel1.id = 1;
            rel2.id = 2;
            rel3.id = 3;

            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel, { cascadeInsert: true })
                public rel: Rel = rel1;

                @RelationProperty(type => [Rel, Set])
                public relSet: Set<Rel> = new Set([rel2]);

                @RelationProperty(type => [Rel, Map])
                public relMap: Map<number, Rel> = new Map([[1, rel3]]);
            }
            const sub: EntitySubscriberInterface<A> = {
                listenTo: () => Rel,
                beforeRemove: jest.fn(),
                afterRemove: jest.fn()
            };
            const manager = new RedisManager(conn, [sub]);
            const a = new A();
            await manager.save(a);
            await manager.remove(a);
            expect(sub.beforeRemove).not.toBeCalled();
            expect(sub.afterRemove).not.toBeCalled();
        });
    });

    describe("On load", () => {
        it("Calls entity subscriber for entity", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number;
            }
            const sub: EntitySubscriberInterface<A> = {
                listenTo: () => A,
                afterLoad: jest.fn()
            };
            const manager = new RedisManager(conn, [sub]);
            const a1 = new A();
            a1.id = 1;
            const a2 = new A();
            a2.id = 2;
            await manager.save(a1);
            await manager.save(a2);

            const res = await manager.load(A, [1, 2]);
            expect(sub.afterLoad).toBeCalledWith(res![0]);
            expect(sub.afterLoad).toBeCalledWith(res![1]);
        });

        it("Calls entity subscriber for relations first", async () => {
            @Entity()
            class InnerRel {
                @IdentifyProperty()
                public id: number;
            }
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => InnerRel, { cascadeInsert: true })
                public innerRel: InnerRel;
            }
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => Rel, { cascadeInsert: true })
                public rel: Rel;
            }

            const inner = new InnerRel();
            inner.id = 1;
            const rel = new Rel();
            rel.id = 1;
            rel.innerRel = inner;
            const a = new A();
            a.id = 1;
            a.rel = rel;

            const afterLoadSpy = jest.fn();

            const innerSub: EntitySubscriberInterface<InnerRel> = {
                listenTo: () => InnerRel,
                afterLoad: afterLoadSpy
            };
            const relSub: EntitySubscriberInterface<Rel> = {
                listenTo: () => Rel,
                afterLoad: afterLoadSpy
            };
            const aSub: EntitySubscriberInterface<A> = {
                listenTo: () => A,
                afterLoad: afterLoadSpy
            };
            const manager = new RedisManager(conn, [innerSub, relSub, aSub]);

            await manager.save(a);

            const b = await manager.load(A, 1);
            expect(afterLoadSpy).toHaveBeenCalledTimes(3);

            expect(afterLoadSpy.mock.calls[0][0]).toBe(b!.rel.innerRel);
            expect(afterLoadSpy.mock.calls[1][0]).toBe(b!.rel);
            expect(afterLoadSpy.mock.calls[2][0]).toBe(b);
        });
    });
});