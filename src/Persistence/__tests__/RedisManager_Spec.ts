import { Connection } from "../../Connection/Connection";
import { Hash } from "../../Decorators/Hash";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { RelationProperty } from "../../Decorators/RelationProperty";
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
        let res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("e:A:1:map1"),
            conn.client.smembersAsync("e:A:1:set1")
        ]);
        expect(res).toMatchSnapshot();

        await monitor.clearMonitorCalls(100);
        a.set1.clear();
        a.map1 = new Map<any, any>();
        await manager.save(a);
        await monitor.wait(100);
        expect(monitor.requests).toMatchSnapshot();
        res = await Promise.all([
            conn.client.hgetallAsync("e:A:1"),
            conn.client.hgetallAsync("e:A:1:map1"),
            conn.client.smembersAsync("e:A:1:set1")
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Doesn't send change requests if there are no any changes", async () => {
        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "rel";
        }
        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "rel";
        }
        @Hash()
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
        @Hash()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop: string = "I'm a";

            public b: B;
        }
        @Hash()
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
        @Hash()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "abc";
        }

        @Hash()
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
        @Hash()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "abc";
        }

        @Hash()
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

    it.skip("Doesn't touch relation if it was skipped for loading", async () => {

    });

    it("Saves only links to multiple relations without cascade insert", async () => {
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Hash()
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
            conn.client.smembersAsync("e:A:1:mySet"),
            conn.client.hgetallAsync("e:A:1:myMap"),
            conn.client.hgetallAsync("e:Rel:1"),
            conn.client.hgetallAsync("e:Rel:2"),
            conn.client.hgetallAsync("e:Rel:3"),
            conn.client.hgetallAsync("e:Rel:4"),
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Saves multiple relations with cascade insert", async () => {
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Hash()
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
            conn.client.smembersAsync("e:A:1:mySet"),
            conn.client.hgetallAsync("e:A:1:myMap"),
            conn.client.hgetallAsync("e:Rel:1"),
            conn.client.hgetallAsync("e:Rel:2"),
            conn.client.hgetallAsync("e:Rel:3"),
            conn.client.hgetallAsync("e:Rel:4"),
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Saves multiple cyclic relations with cascade insert", async () => {
        @Hash()
        class AnotherRel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop2: boolean;

            public a: A;
        }
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;

            @RelationProperty(type => [AnotherRel, AnotherRel], { cascadeInsert: true })
            public rel2: AnotherRel;
        }

        @Hash()
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
            conn.client.smembersAsync("e:A:1:mySet"),
            conn.client.hgetallAsync("e:A:1:myMap"),
            conn.client.hgetallAsync("e:Rel:1"),
            conn.client.hgetallAsync("e:Rel:2"),
            conn.client.hgetallAsync("e:Rel:3"),
            conn.client.hgetallAsync("e:Rel:4"),
            conn.client.hgetallAsync("e:AnotherRel:1"),
            conn.client.hgetallAsync("e:AnotherRel:2"),
        ]);
        expect(res).toMatchSnapshot();
    });

    it("Updates relations in maps/sets with cascade update", async () => {
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;
        }

        @Hash()
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

    it.skip("Doesn't delete relations in maps and sets if skipped them for loading", () => {

    });
});