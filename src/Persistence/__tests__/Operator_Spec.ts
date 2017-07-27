import { LazyMap } from "../../Collections/LazyMap";
import { LazySet } from "../../Collections/LazySet";
import { RedisLazyMap } from "../../Collections/RedisLazyMap";
import { RedisLazySet } from "../../Collections/RedisLazySet";
import { Entity } from "../../Decorators/Entity";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { RelationProperty } from "../../Decorators/RelationProperty";
import { DuplicateIdsInEntityError, MetadataError } from "../../Errors/Errors";
import { PropertyMetadata, REDIS_COLLECTION_VALUE, REDIS_PROPERTIES, REDIS_VALUE } from "../../Metadata/Metadata";
import { ShouldThrowError } from "../../testutils/ShouldThrowError";
import { TestRedisInitialCollectionValue, TestRedisInitialValue } from "../../testutils/TestDecorators";
import { HydrationData, Operator } from "../Operator";

let operator: Operator;

beforeEach(() => {
    operator = new Operator();
});

describe("Save/Delete/Update", () => {
    it("Throws error if class is not decorated with @Hash", async () => {
        class A { }
        try {
            await operator.getSaveOperation(new A());
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
        try {
            operator.getDeleteOperation(new A());
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
    });

    it("Throws error if class doesn't contain any @Property decorator", async () => {
        @Entity()
        class A { }

        try {
            await operator.getSaveOperation(new A());
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
        try {
            operator.getDeleteOperation(new A());
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
    });

    it("Throws error if class doesn't contain @IdentifyProperty decorator", async () => {
        @Entity()
        class A {
            @Property(Number)
            public prop: number;
        }
        try {
            await operator.getSaveOperation(new A());
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
        try {
            operator.getDeleteOperation(new A());
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
    });

    it("Throws error if @IdentifyProperty is not a number or string", async () => {
        @Entity()
        class A {
            @IdentifyProperty(Number)
            public prop: number; // undefined
        }
        const a = new A();
        try {
            await operator.getSaveOperation(a);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
        try {
            a.prop = new Date() as any;
            await operator.getSaveOperation(a);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
        try {
            operator.getDeleteOperation(a);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
        try {
            a.prop = new Date() as any;
            operator.getDeleteOperation(a);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
    });

    it("Process simple properties", async () => {
        @Entity()
        class A {
            @IdentifyProperty("identify")
            public id: number = 1;

            @Property()
            public prop1: number = 10.4;
        
            @Property()
            public prop2: string = "test1";

            @Property(Boolean)
            public prop3: boolean = false;

            @Property("anotherBool")
            public prop4: boolean = true;

            @Property(Symbol as any)
            public prop5: Symbol = Symbol("test");

            @Property(Date)
            public prop6: Date = new Date(Date.UTC(2016, 10, 10, 10, 10, 10));

            @Property()
            public prop7: string | null = null;

            @Property()
            public prop8: number | undefined = undefined;

            @Property()
            public prop9: object = { a: true, b: "abc" };

            @Property()
            public prop10: any[] = ["abc", "def"];

            @Property()
            public prop11: object | null = null;

            @Property()
            public prop12: Function = () => { }
        }

        const a = new A();
        let res = await operator.getSaveOperation(a);
        expect(res).toMatchSnapshot();

        res = operator.getDeleteOperation(a);
        expect(res).toMatchSnapshot();
    });

    it("Process Map and Sets in properties", async () => {
        class MyMap extends Map {
            public constructor(...args: any[]) {
                super(...args);
            }
        }
        class MySet extends Set {
            public constructor(...args: any[]) {
                super(...args);
            }
        }
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property(Set)
            public set1: Set<any> = new Set([1, 2, 3]);
            @Property("anotherSet", Set)
            public set2: Set<any> = new Set(["1", "2", "3"]);
            @Property(Set)
            public set3: Set<any> = new Set(["1", null, undefined, true, () => { }]);
            @Property(Set)
            public set4: Set<any> | null = null;
            @Property(Set)
            public set5: Set<any> | undefined = undefined;
            @Property(MySet)
            public set6: MySet = new MySet(["1", "2"]);

            @Property(Map)
            public map1: Map<any, any> = new Map<any, any>([
                ["1", 1],
                ["2", 2],
                ["3", true],
                ["4", "abc"],
                ["5", { a: "def" }],
                ["6", undefined],
                ["7", null],
                [8, "aaa"],
                ["9", () => { }]
            ]);
            @Property(Map)
            public map2: Map<any, any> | null = null;
            @Property(Map)
            public map3: Map<any, any> | undefined = undefined;
            @Property(MyMap)
            public map4: MyMap = new MyMap([["1", true]]);
        }

        const a = new A();
        const res = await operator.getSaveOperation(a);
        expect(res).toMatchSnapshot();

        const deleteRes = operator.getDeleteOperation(a);
        expect(deleteRes).toMatchSnapshot();
    });

    it("Simple values and updating/deleting over existing redis value", async () => {
        @Entity()
        class A {
            @IdentifyProperty()
            @TestRedisInitialValue()
            public id: number = 1;

            @Property()
            @TestRedisInitialValue()
            public prop1: number = 10.4;
        
            @Property()
            @TestRedisInitialValue()
            public prop2: string = "test1";

            @Property()
            @TestRedisInitialValue()
            public prop3: boolean = false;

            @Property()
            @TestRedisInitialValue()
            public prop4: boolean | undefined = true;

            @Property()
            @TestRedisInitialValue()
            public prop5: string | null = "test2";

            @Property(Date)
            @TestRedisInitialValue()
            public prop6: Date = new Date(Date.UTC(2016, 10, 10, 10, 10, 10));

            @Property()
            @TestRedisInitialValue()
            public prop7: string | null = null;

            @Property()
            public prop8: number | undefined = undefined;

            @Property()
            @TestRedisInitialValue()
            public prop9: object = { a: true, b: "abc" };

            @Property()
            @TestRedisInitialValue()
            public prop10: any[] = ["abc", "def"];

            @Property()
            @TestRedisInitialValue()
            public prop11: object | null = null;

            @Property()
            @TestRedisInitialValue()
            public prop12: string = "nonchanged";

            @Property()
            @TestRedisInitialValue()
            public prop13: number = 50;
        }

        const a = new A();
        a.prop1 = 4.5;
        a.prop2 = "modified1";
        a.prop3 = true;
        a.prop4 = undefined;
        a.prop5 = null;
        a.prop6 = new Date(Date.UTC(2016, 11, 10, 10, 10, 10));
        a.prop7 = "fromnull";
        a.prop8 = 5;
        (a.prop9 as any).a = false;
        (a.prop10 as any)[0] = "111";
        a.prop11 = { def: "def" };

        const res = await operator.getSaveOperation(a);
        expect(res).toMatchSnapshot();
    });

    describe("Simple map and sets changing and updating", () => {
        @Entity()
        class A {
            @IdentifyProperty(Number)
            @TestRedisInitialValue()
            public id: number = 1;

            @Property(Set)
            @TestRedisInitialCollectionValue()
            public setModified: Set<any> = new Set([1, 2, 3]);
            @Property(Set)
            @TestRedisInitialCollectionValue()
            public setToNull: Set<any> | null = new Set([1, 2, 3]);
            @Property(Set)
            @TestRedisInitialCollectionValue()
            public setToUndefined: Set<any> | undefined = new Set([1, 2, 3]);
            @Property(Set)
            @TestRedisInitialValue()
            public createdNewSet: Set<any> | null = null;
            @Property(Set)
            public createdNewEmptySet: Set<any> | undefined = undefined;
            @Property(Set)
            @TestRedisInitialCollectionValue()
            public setEmptied: Set<any> = new Set([1, 2, 3]);

            @Property(Map)
            @TestRedisInitialCollectionValue()
            public mapChanged: Map<any, any> = new Map<any, any>([
                ["1", 1],
                ["2", 2],
                ["3", 1],
                ["4", "abc"],
                ["5", { a: "def" }],
                ["6", null],
                ["7", "aaa"],
            ]);
            @Property(Map)
            @TestRedisInitialCollectionValue()
            public mapToNull: Map<any, any> | null = new Map<any, any>([
                ["1", 1],
            ]);
            @Property(Map)
            @TestRedisInitialCollectionValue()
            public mapToUndefined: Map<any, any> | undefined = new Map<any, any>([
                ["1", 1],
            ]);
            @Property(Map)
            @TestRedisInitialValue()
            public createdNewMap: Map<any, any> | null = null;
            @Property(Map)
            public createdNewEmptyMap: Map<any, any> | undefined = undefined;
            @Property(Map)
            @TestRedisInitialCollectionValue()
            public mapEmptied: Map<any, any> = new Map<any, any>([["1", "1"]]);
        }

        it("Changing", async () => {
            const a = new A();
            a.setModified.add(4);
            a.setModified.delete(1);
            a.setToNull = null;
            a.setToUndefined = undefined;
            a.createdNewSet = new Set(["10", "11"]);
            a.createdNewEmptySet = new Set();
            a.setEmptied.clear();

            a.mapChanged.set("8", "abcdef");
            a.mapChanged.delete("7");
            a.mapChanged.delete("6");
            a.mapChanged.get("5").a = "111";
            a.mapToNull = null;
            a.mapToUndefined = undefined;
            a.createdNewMap = new Map<any, any>([["1", "abcde"], ["2", "test"], ["3", 5]]);
            a.createdNewEmptyMap = new Map();
            a.mapEmptied.clear();

            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Deleting entity with related maps/sets", () => {
            const a = new A();
            const res = operator.getDeleteOperation(a);
            expect(res).toMatchSnapshot();
        });
    });


    describe("Single relation", () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public relTest: string = "test";
        }
        it("Saves new relation without cascade inserting", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel)
                public rel: Rel = new Rel();
            }
            const a = new A();
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Saves new relation with cascade inserting", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel, { cascadeInsert: true })
                public rel: Rel = new Rel();
            }
            const a = new A();
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Saves new relation over previous relation without cascade inserting", async () => {
            const rel = new Rel();
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel)
                @TestRedisInitialValue(rel)
                public rel: Rel = rel;
            }
            const a = new A();
            const newRel = new Rel();
            newRel.id = 2;
            a.rel = newRel;
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Throws if relation is invalid", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel)
                public rel: Rel;
            }
            class B { }
            @Entity()
            class C { 
                @Property()
                public prop: string = "";
            }

            const a = new A();
            a.rel = {} as any;
            try {
                await operator.getSaveOperation(a);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(MetadataError);
            }
            a.rel = new B() as any;
            try {
                await operator.getSaveOperation(a);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(MetadataError);
            }
            a.rel = new C() as any;
            try {
                await operator.getSaveOperation(a);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(MetadataError);
            }
        });

        it("Saves new relation over previous relation with cascade inserting", async () => {
            const rel = new Rel();
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel, { cascadeInsert: true })
                @TestRedisInitialValue(rel)
                public rel: Rel = rel;
            }
            const a = new A();
            const newRel = new Rel();
            newRel.id = 2;
            a.rel = newRel;
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Change in relation without cascade update", async () => {
            const rel = new Rel();
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => Rel)
                @TestRedisInitialValue()
                public rel: Rel = rel;
            }
            const a = new A();
            a.rel.relTest = "new test";
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Change in relation with cascade update", async () => {
            const rel = new Rel();
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => Rel, { cascadeUpdate: true })
                @TestRedisInitialValue()
                public rel: Rel = rel;
            }
            const a = new A();
            a.rel.relTest = "new test";
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Set relation to null", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Rel])
                @TestRedisInitialValue()
                public rel: Rel | null = new Rel();
            }
            const a = new A();
            a.rel = null;
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Set relation to undefined", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Rel])
                @TestRedisInitialValue()
                public rel: Rel | undefined = new Rel();
            }
            const a = new A();
            a.rel = undefined;
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Set relation from null to undefined", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Rel], { cascadeInsert: true, cascadeUpdate: true })
                @TestRedisInitialValue()
                public rel: Rel | null | undefined = null;
            }
            const a = new A();
            a.rel = undefined;
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Update relation without cascadeUpdate", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Rel])
                @TestRedisInitialValue()
                public rel: Rel = new Rel();
            }
            const a = new A();
            a.rel.relTest = "new test";
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Update relation with cascadeUpdate", async () => {
            const rel = new Rel();
            TestRedisInitialValue(1)(rel, "id");
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Rel], { cascadeUpdate: true })
                @TestRedisInitialValue(rel)
                public rel: Rel = rel;
            }
            const a = new A();
            a.rel.relTest = "new test";
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Delete with relation doesn't delete relation itself", () => {
            const rel = new Rel();
            TestRedisInitialValue(1)(rel, "id");
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Rel])
                @TestRedisInitialValue(rel)
                public rel: Rel = rel;
            }
            const a = new A();
            const res = operator.getDeleteOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Prevents circular references when inserting", async () => {
            @Entity()
            class A { 
                @IdentifyProperty()
                public id: number = 1;

                public bTest: B;
            }

            @Entity()
            class B {
                @IdentifyProperty()
                public id: number = 1;

                public aTest: A;
            }

            const a = new A();
            const b = new B();

            // Decorate explicitly
            RelationProperty(type => [B, B], { cascadeInsert: true })(a, "bTest");
            RelationProperty(type => [A, A], { cascadeInsert: true })(b, "aTest");
            a.bTest = b;
            b.aTest = a;
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Prevents circular references when updating", async () => {
            @Entity()
            class A { 
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                public bTest: B;
            }

            @Entity()
            class B {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @Property()
                @TestRedisInitialValue()
                public relTest: string = "abc";

                public aTest: A;
            }

            const a = new A();
            const b = new B();

            // Decorate explicitly
            RelationProperty(type => [B, B], { cascadeUpdate: true })(a, "bTest");
            TestRedisInitialValue(b)(a, "bTest");

            RelationProperty(type => [A, A], { cascadeUpdate: true })(b, "aTest");
            TestRedisInitialValue(a)(b, "aTest");
            a.bTest = b;
            b.aTest = a;
            a.bTest.relTest = "olo test";
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        describe("Complex and nested relations and cascade ops", () => {
            @Entity()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public text: string = "another rel";
            }

            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number = 1;

                @Property(Set)
                public set1: Set<string> = new Set(["1", "2", "3"]);

                @Property(Map)
                public map1: Map<any, any> = new Map([["1", "sometext"]]);

                @RelationProperty(type => AnotherRel, { cascadeInsert: true, cascadeUpdate: true })
                public anotherRel: AnotherRel = new AnotherRel();
            }

            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel, { cascadeInsert: true,  cascadeUpdate: true })
                public rel: Rel = new Rel();
            }

            it("Insert", async () => {
                const a = new A();
                const res = await operator.getSaveOperation(a);
                expect(res).toMatchSnapshot();
            });

            it("Delete", () => {
                const a = new A();
                TestRedisInitialValue(1)(a, "id");
                TestRedisInitialValue(a.rel)(a, "rel");

                TestRedisInitialValue(1)(a.rel, "id");
                TestRedisInitialCollectionValue(a.rel.set1)(a.rel, "set1");
                TestRedisInitialCollectionValue(a.rel.map1)(a.rel, "map1");
                TestRedisInitialValue(a.rel.anotherRel)(a.rel, "anotherRel");
                a.rel.set1 = new Set(a.rel.set1);
                a.rel.map1 = new Map(a.rel.map1);

                TestRedisInitialValue(1)(a.rel.anotherRel, "id");
                TestRedisInitialValue("another rel")(a.rel.anotherRel, "text");

                const res = operator.getDeleteOperation(a);
                // Only A must be deleted
                expect(res).toMatchSnapshot();
            });

            it("Updating", async () => {
                const a = new A();
                TestRedisInitialValue(1)(a, "id");
                TestRedisInitialValue(a.rel)(a, "rel");

                TestRedisInitialValue(1)(a.rel, "id");
                TestRedisInitialCollectionValue(new Set(["1", "2", "3"]))(a.rel, "set1");
                TestRedisInitialCollectionValue(new Map([["1", "sometext"]]))(a.rel, "map1");
                TestRedisInitialValue(a.rel.anotherRel)(a.rel, "anotherRel");
                a.rel.set1 = new Set(a.rel.set1);
                a.rel.map1 = new Map(a.rel.map1);

                TestRedisInitialValue(1)(a.rel.anotherRel, "id");
                TestRedisInitialValue("another rel")(a.rel.anotherRel, "text");

                a.rel.anotherRel.text = "some new text";
                let res = await operator.getSaveOperation(a);
                expect(res).toMatchSnapshot();

                const newAnotherRel = new AnotherRel();
                newAnotherRel.id = 2;
                newAnotherRel.text = "new text";
                a.rel.anotherRel = newAnotherRel;
                res = await operator.getSaveOperation(a);
                // must not delete AnotherRel:1
                expect(res).toMatchSnapshot();

                const newRel = new Rel();
                newRel.map1.clear();
                newRel.set1.clear();
                newRel.id = 2;
                a.rel = newRel;
                res = await operator.getSaveOperation(a);
                expect(res).toMatchSnapshot();
            });
        });
    });

    describe("Multiple relations in sets", () => {
        it("Save hash with relation in sets without cascade insert", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Set])
                public rels: Set<Rel> = new Set();
            }
            const e = new E();
            e.id = 1;

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            e.rels.add(rel1);
            e.rels.add(rel2);
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save hash with relation in sets with cascade insert", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
                public rels: Set<Rel> = new Set();
            }
            const e = new E();
            e.id = 1;

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            e.rels.add(rel1);
            e.rels.add(rel2);
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save nested relations in sets with cascade insert", async () => {
            @Entity()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public prop: string = "another rel";
            }
            const anotherRel = new AnotherRel();
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;

                @RelationProperty(type => AnotherRel, { cascadeInsert: true })
                public insideRel: AnotherRel = anotherRel;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
                public rels: Set<Rel> = new Set();
            }
            const e = new E();
            e.id = 1;

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            e.rels.add(rel1);
            e.rels.add(rel2);
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save cyclic relations with cascade insert", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                public bSet: Set<B>;
            }
            @Entity()
            class B { 
                @IdentifyProperty()
                public id: number = 1;
                public aSet: Set<A>;
            }
            const a = new A();
            const b = new B();

            RelationProperty(type => [B, Set], { cascadeInsert: true })(a, "bSet");
            RelationProperty(type => [A, Set], { cascadeInsert: true })(b, "aSet");
            a.bSet = new Set([b]);
            b.aSet = new Set([a]);
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Tracks deletion/addition of relations in set", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }
            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            @Entity()
            class E {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
                @TestRedisInitialCollectionValue()
                public rels: Set<Rel> = new Set([rel1, rel2]);
            }
            const e = new E();
            e.id = 1;
            e.rels.add(rel1);
            e.rels.add(rel2);


            const rel3 = new Rel();
            rel3.id = 3;
            rel3.prop = "rel3";

            e.rels.delete(rel2);
            e.rels.add(rel3);

            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Tracks changes in relations with cascadeUpdate", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }
            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            TestRedisInitialValue(1)(rel1, "id");
            TestRedisInitialValue("rel1")(rel1, "prop");

            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";
            TestRedisInitialValue(2)(rel2, "id");
            TestRedisInitialValue("rel2")(rel2, "prop");

            @Entity()
            class E {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Set], { cascadeInsert: true, cascadeUpdate: true })
                @TestRedisInitialCollectionValue()
                public rels: Set<Rel> = new Set([rel1, rel2]);
            }
            const e = new E();
            e.id = 1;
            e.rels.add(rel1);
            e.rels.add(rel2);

            rel2.prop = "changed prop";

            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Works when replacing relation set with new object", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            @Entity()
            class E {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
                @TestRedisInitialCollectionValue()
                public rels: Set<Rel> = new Set([rel1, rel2]);
            }
            const e = new E();
            e.rels = new Set([...e.rels.values()].filter(rel => rel.id !== 1));
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Throws error if there are objects with same id but have different object links in relation set", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Set], { cascadeInsert: true })
                public rels: Set<Rel> = new Set();
            }
            const e = new E();
            e.id = 1;
            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 1;
            rel2.prop = "rel2";
            e.rels.add(rel1);
            e.rels.add(rel2);

            try {
                await operator.getSaveOperation(e);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(DuplicateIdsInEntityError);
            }
        });

        describe("Has different objects with same id in deep relation", () => {
            @Entity()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public prop: string = "another rel";
            }
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;

                @RelationProperty(type => AnotherRel, { cascadeInsert: true })
                public insideRel: AnotherRel = new AnotherRel();
            }

            let e: any;
            beforeEach(() => {
                @Entity()
                class E {
                    @IdentifyProperty()
                    public id: number;

                    public rels: Set<Rel> = new Set();
                }
                e = new E();
                e.id = 1;

                const rel1 = new Rel();
                rel1.id = 1;
                rel1.prop = "rel1";
                const rel2 = new Rel();
                rel2.id = 2;
                rel2.prop = "rel2";

                e.rels.add(rel1);
                e.rels.add(rel2);
            });

            it("throws if saving with cascade insert", async () => {
                RelationProperty(type => [Rel, Set], { cascadeInsert: true })(e, "rels");
                try {
                    await operator.getSaveOperation(e);
                    throw new ShouldThrowError();
                } catch (e) {
                    expect(e).toBeInstanceOf(DuplicateIdsInEntityError);
                }
            });

            it("doesn't throws if saving without cascade insert", async () => {
                RelationProperty(type => [Rel, Set])(e, "rels");
                await operator.getSaveOperation(e);
            });
        });

        it("Deletes relation sets but not relation itself", () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number;

            }
            const rel1 = new Rel();
            rel1.id = 1;
            const rel2 = new Rel();
            rel2.id = 2;
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Set])
                @TestRedisInitialCollectionValue()
                public set1: Set<Rel> = new Set([rel1, rel2]);
            }
            const res = operator.getDeleteOperation(new A());
            expect(res).toMatchSnapshot();
        });
    });

    describe("Multiple relations in maps", () => {
        it("Save hash with relation in maps without cascade insert", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Map])
                public rels: Map<string | number, Rel> = new Map();
            }
            const e = new E();
            e.id = 1;

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            e.rels.set(1, rel1);
            e.rels.set(2, rel2);
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save hash with relation in maps with cascade insert", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
                public rels: Map<string | number, Rel> = new Map();
            }
            const e = new E();
            e.id = 1;

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            e.rels.set(1, rel1);
            e.rels.set("2", rel2);
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Allows multiple keys to same relation object", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
                public rels: Map<string | number, Rel> = new Map();
            }
            const e = new E();
            e.id = 1;

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            e.rels.set(1, rel1);
            e.rels.set("2", rel2);
            e.rels.set(3, rel1);
            e.rels.set(4, rel2);
            e.rels.set("4", rel2);
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save nested relations in maps with cascade insert", async () => {
            @Entity()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public prop: string = "another rel";
            }
            const anotherRel = new AnotherRel();
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;

                @RelationProperty(type => AnotherRel, { cascadeInsert: true })
                public insideRel: AnotherRel = anotherRel;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
                public rels: Map<number, Rel> = new Map();
            }
            const e = new E();
            e.id = 1;

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            e.rels.set(1, rel1);
            e.rels.set(2, rel2);
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save cyclic relations with cascade insert", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                public bMap: Map<number, B>;
            }
            @Entity()
            class B { 
                @IdentifyProperty()
                public id: number = 1;
                public aMap: Map<number, A>;
            }
            const a = new A();
            const b = new B();

            RelationProperty(type => [B, Map], { cascadeInsert: true })(a, "bMap");
            RelationProperty(type => [A, Map], { cascadeInsert: true })(b, "aMap");
            a.bMap = new Map([[1, b]]);
            b.aMap = new Map([[1, a]]);
            const res = await operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Tracks deletion/addition of relations in relation map", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }
            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            @Entity()
            class E {
                @IdentifyProperty(Number)
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
                @TestRedisInitialCollectionValue()
                public rels: Map<number, Rel> = new Map([[1, rel1], [2, rel2]]);
            }
            const e = new E();

            const rel3 = new Rel();
            rel3.id = 3;
            rel3.prop = "rel3";

            e.rels.delete(2);
            e.rels.set(3, rel3);
            e.rels.set(1, rel3);

            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Tracks changes in relations with cascadeUpdate", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            TestRedisInitialValue(1)(rel1, "id");
            TestRedisInitialValue("rel1")(rel1, "prop");

            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";
            TestRedisInitialValue(2)(rel2, "id");
            TestRedisInitialValue("rel2")(rel2, "prop");

            @Entity()
            class E {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Map], { cascadeInsert: true, cascadeUpdate: true })
                @TestRedisInitialCollectionValue()
                public rels: Map<number, Rel> = new Map([[1, rel1], [2, rel2]]);
            }
            const e = new E();

            rel2.prop = "changed prop";

            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Works when replacing relation map with new object", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }
            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 2;
            rel2.prop = "rel2";

            @Entity()
            class E {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
                @TestRedisInitialCollectionValue()
                public rels: Map<number, Rel> = new Map([[1, rel1], [2, rel2]]);
            }
            const e = new E();

            const newMap = new Map<number, Rel>([
                [2, rel2]
            ]);
            e.rels = newMap;
            const res = await operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Throws error if there are objects with same id but have different object links in relation map", async () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Entity()
            class E {
                @IdentifyProperty()
                public id: number;

                @RelationProperty(type => [Rel, Map], { cascadeInsert: true })
                public rels: Map<number, Rel> = new Map();
            }
            const e = new E();
            e.id = 1;
            const rel1 = new Rel();
            rel1.id = 1;
            rel1.prop = "rel1";
            const rel2 = new Rel();
            rel2.id = 1;
            rel2.prop = "rel2";
            e.rels.set(1, rel1);
            e.rels.set(2, rel2);

            try {
                await operator.getSaveOperation(e);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(DuplicateIdsInEntityError);
            }
        });

        describe("Has different objects with same id in deep relation", () => {
            @Entity()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public prop: string = "another rel";
            }
            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;

                @RelationProperty(type => AnotherRel, { cascadeInsert: true })
                public insideRel: AnotherRel = new AnotherRel();
            }

            let e: any;
            beforeEach(() => {
                @Entity()
                class E {
                    @IdentifyProperty()
                    public id: number;

                    public rels: Map<number, Rel> = new Map();
                }
                e = new E();
                e.id = 1;

                const rel1 = new Rel();
                rel1.id = 1;
                rel1.prop = "rel1";
                const rel2 = new Rel();
                rel2.id = 2;
                rel2.prop = "rel2";

                e.rels.set(1, rel1);
                e.rels.set(2, rel2);
            });

            it("throws if saving with cascade insert", async () => {
                RelationProperty(type => [Rel, Map], { cascadeInsert: true })(e, "rels");
                try {
                    await operator.getSaveOperation(e);
                    throw new ShouldThrowError();
                } catch (e) {
                    expect(e).toBeInstanceOf(DuplicateIdsInEntityError);
                }
            });

            it("doesn't throws if saving without cascade insert", async () => {
                RelationProperty(type => [Rel, Map])(e, "rels");
                await operator.getSaveOperation(e);
            });
        });

        it("Deletes relation maps but not relation itself", () => {
            @Entity()
            class Rel {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number;

            }
            const rel1 = new Rel();
            rel1.id = 1;
            const rel2 = new Rel();
            rel2.id = 2;
            @Entity()
            class A {
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                @RelationProperty(type => [Rel, Map])
                @TestRedisInitialCollectionValue()
                public set1: Map<number, Rel> = new Map([
                    [1, rel1],
                    [2, rel2]
                ]);
            }
            const res = operator.getDeleteOperation(new A());
            expect(res).toMatchSnapshot();
        });
    });

    it("Return delete operation for entity class with id", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property(Map)
            public map: Map<any, any>;

            @Property(Set)
            public set: Set<any>;
        }

        let res = operator.getDeleteOperation(A, 1);
        expect(res).toMatchSnapshot();

        res = operator.getDeleteOperation(A, "e:A:1");
        expect(res).toMatchSnapshot();
    });

    it("Returns delete operation for entity with lazy sets/maps", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property(LazyMap)
            public map: LazyMap<any, any>;

            @Property(LazySet)
            public set: LazySet<any>;
        }
        const resA = operator.getDeleteOperation(A, 1);
        expect(resA).toMatchSnapshot();

        @Entity()
        class B {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => [A, LazyMap])
            public map: LazyMap<any, any>;

            @RelationProperty(type => [A, LazySet])
            public set: LazySet<any>;
        }
        const resB = operator.getDeleteOperation(B, 1);
        expect(resB).toMatchSnapshot();
    });

    describe("Save operation with lazy maps/sets", () => {
        it("Doesn't push any operations for wrapped redis maps and sets", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @Property(LazyMap)
                public map: LazyMap<any, any> = new LazyMap([[1, 1], [2, 1]]);

                @Property(LazySet)
                public set: LazySet<any> = new LazySet([1, 2, 3]);
            }
            const mockedLazyMap = new RedisLazyMap("", {} as any);
            mockedLazyMap.toArray = jest.fn().mockReturnValue(Promise.resolve([[1, 1], [2, 1]]));
            mockedLazyMap.size = jest.fn().mockReturnValue(Promise.resolve(2));
            const mockedLazySet = new RedisLazySet("", {} as any);
            mockedLazySet.toArray = jest.fn().mockReturnValue(Promise.resolve([1, 2, 3]));
            mockedLazySet.size = jest.fn().mockReturnValue(Promise.resolve(3));
            const a = new A();
            a.map = mockedLazyMap;
            a.set = mockedLazySet;

            const op = await operator.getSaveOperation(a);
            expect(op).toMatchSnapshot();
        });

        it("Treats lazy maps and sets as ordinary maps and sets for first save operation", async () => {
            @Entity()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @Property(LazyMap)
                public map: LazyMap<any, any> = new LazyMap([[1, 1], [2, 1]]);

                @Property(LazySet)
                public set: LazySet<any> = new LazySet([1, 2, 3]);
            }
            const a = new A();
            let op = await operator.getSaveOperation(a);
            expect(op).toMatchSnapshot();

            @Entity()
            class Rel {
                @IdentifyProperty()
                public id: number;
            }

            @Entity()
            class B {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => [Rel, LazyMap])
                public map: LazyMap<any, any> = new LazyMap();

                @RelationProperty(type => [Rel, LazySet])
                public set: LazySet<any> = new LazySet();
            }
            const rel = new Rel();
            rel.id = 1;
            const b = new B();
            await b.map.set(1, rel);
            await b.map.set(2, rel);
            await b.set.add(rel);

            op = await operator.getSaveOperation(b);
            expect(op).toMatchSnapshot();

            @Entity()
            class C {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => [Rel, LazyMap], { cascadeInsert: true })
                public map: LazyMap<any, any> = new LazyMap();

                @RelationProperty(type => [Rel, LazySet], { cascadeInsert: true })
                public set: LazySet<any> = new LazySet();
            }
            const c = new C();
            await c.map.set(1, rel);
            await c.map.set(2, rel);
            await c.set.add(rel);

            op = await operator.getSaveOperation(c);
            expect(op).toMatchSnapshot();
        });
    });
});

describe("Load", () => {
    it("Throws on invalid class", () => {
        try {
            operator.getLoadOperation("test", {} as any);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        try {
            operator.getLoadOperation("test", Object);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        class A { }
        try {
            operator.getLoadOperation("test", A);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        @Entity()
        class B { }
        try {
            operator.getLoadOperation("test", B);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        @Entity()
        class C {
            @Property(Number)
            public prop: number;
        }
        try {
            operator.getLoadOperation("test", C);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
    });

    it("Return load operation for simple hash", () => {
        @Entity()
        class E {
            @IdentifyProperty(Number)
            public id: number;

            @Property(String)
            public test: string;
        }

        const res = operator.getLoadOperation(1, E);
        expect(res).toMatchSnapshot();
    });

    it("Return load operation for hash with non relation sets or maps", () => {
        @Entity()
        class E {
            @IdentifyProperty(Number)
            public id: number;

            @Property(Set)
            public set: Set<any>;

            @Property(Map)
            public map: Map<string, any>;
        }

        const res = operator.getLoadOperation(1, E);
        expect(res).toMatchSnapshot();
    });

    it("Return load operation for hash with relation sets or maps", () => {
        @Entity()
        class Rel {
            @IdentifyProperty(Number)
            public id: number;
        }
        @Entity()
        class E {
            @IdentifyProperty(Number)
            public id: number;

            @RelationProperty(type => [Rel, Set])
            public set: Set<any>;

            @RelationProperty(type => [Rel, Map])
            public map: Map<string, any>;
        }

        const res = operator.getLoadOperation(1, E);
        expect(res).toMatchSnapshot();
    });

    it("Return load operation for map/sets with specified redis name", () => {
        @Entity()
        class Rel {
            @IdentifyProperty(Number)
            public id: number;
        }
        @Entity()
        class E {
            @IdentifyProperty(Number)
            public id: number;

            @RelationProperty(type => [Rel, Set], { propertyName: "mySet" })
            public set: Set<any>;

            @RelationProperty(type => [Rel, Map], { propertyName: "myMap" })
            public map: Map<string, any>;

            @Property("mySet2", Set)
            public set2: Set<any>;

            @Property("myMap2", Map)
            public map2: Map<any, any>;
        }
        const res = operator.getLoadOperation(1, E);
        expect(res).toMatchSnapshot();
    });

    it("Return load operation with skipped relation maps/sets", () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }
        @Entity()
        class E {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => [Rel, Set])
            public relSet1: Set<any>;

            @RelationProperty(type => [Rel, Map])
            public relMap1: Map<string, any>;

            @RelationProperty(type => [Rel, Set])
            public relSet2: Set<any>;

            @RelationProperty(type => [Rel, Map])
            public relMap2: Map<string, any>;

            @Property(Set)
            public nonRelSet: Set<any>;

            @Property(Map)
            public nonRelMap: Map<any, any>;
        }
        const res = operator.getLoadOperation(1, E, ["relSet1", "relMap1", "nonRelSet", "nonRelMap"]);
        // nonRelSet/nonRelMap will be loaded since it's not relations
        expect(res).toMatchSnapshot();
    });

    it("Loads hash by full hash id", () => {
        @Entity()
        class E {
            @IdentifyProperty(Number)
            public id: number;

            @Property(Set)
            public set: Set<any>;

            @Property(Map)
            public map: Map<string, any>;
        }

        const res = operator.getLoadOperation("e:E:1", E);
        expect(res).toMatchSnapshot();
    });

    it("Returns undefined operation if pass 'null' as id", () => {
        @Entity()
        class E {
            @IdentifyProperty(Number)
            public id: number;

            @Property(Set)
            public set: Set<any>;

            @Property(Map)
            public map: Map<string, any>;
        }

        const res = operator.getLoadOperation("null", E);
        expect(res).toBeUndefined();
    });

    it("Doesn't load lazy sets or maps", () => {
        @Entity()
        class E {
            @IdentifyProperty()
            public id: number;

            @Property(LazySet)
            public set: LazySet<any>;

            @Property(LazyMap)
            public map: LazyMap<number, string>;

            @Property(RedisLazySet as any)
            public set2: RedisLazySet<any>;

            @Property(RedisLazyMap as any)
            public map2: RedisLazyMap<any, any>;
        }

        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => [Rel, LazySet])
            public set: LazySet<any>;

            @RelationProperty(type => [Rel, LazyMap])
            public map: LazyMap<number, string>;

            @RelationProperty(type => [Rel, RedisLazySet])
            public set2: RedisLazySet<any>;

            @RelationProperty(type => [Rel, RedisLazyMap])
            public map2: RedisLazyMap<any, any>;
        }

        const eRes = operator.getLoadOperation(1, E);
        const aRes = operator.getLoadOperation(1, A);
        expect(eRes).toMatchSnapshot();
        expect(aRes).toMatchSnapshot();
    });
});

describe("Update metadata", () => {
    it("Throws on invalid hash class", () => {
        try {
            operator.updateMetadataInHash({} as any);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        try {
            operator.updateMetadataInHash(Object);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        class A { }
        try {
            operator.updateMetadataInHash(A);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        @Entity()
        class B { }
        try {
            operator.updateMetadataInHash(B);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        @Entity()
        class C {
            @Property(Number)
            public prop: number;
        }
        try {
            operator.updateMetadataInHash(C);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
    });

    it("Sets metadata for simple properties", () => {
        @Entity()
        class MetadataUpdate {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public prop1: string = "a";

            @Property()
            public prop2: string | null = null;

            @Property()
            public prop3: string | undefined = undefined;
            
            @Property(Date)
            public prop4: Date = new Date(2016, 10, 10, 10, 10, 10);

            // @Property(Object)
            // public prop5: object = { a: 1, b: "olo" };

            @Property()
            public prop6: any[] = [1, 2, 3, false];

            @Property()
            public prop7: boolean = true;

            // invalid properties
            @Property()
            public prop8: Symbol = Symbol("test");

            @Property()
            public prop9: Function = () => { }

            // tslint:disable-next-line:member-ordering
            public prop10: string = "abcdef";

        }

        const a = new MetadataUpdate();
        operator.updateMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "id")).toBe("i:1");
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop1")).toBe("s:a");
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop2")).toBe("null");
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop3")).toBe(undefined);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop4")).toBe(`d:${new Date(2016, 10, 10, 10, 10, 10).getTime()}`);
        // expect(Reflect.getMetadata(REDIS_VALUE, a, "prop5")).toBe(JSON.stringify({ a: 1, b: "olo" }));
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop6")).toBe(`j:${JSON.stringify([1, 2, 3, false ])}`);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop7")).toBe("b:1");

        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop8")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop9")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop10")).toBeUndefined();
    });

    it("Updates metadata for non relation sets and maps", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property(Set)
            public set1: Set<any> = new Set([1, 2, 3]);

            @Property(Set)
            public set2: Set<any> | null = null;

            @Property(Set)
            public set3: Set<any> | undefined = undefined;

            @Property(Set)
            public set4: Set<any> = new Set();

            @Property(Map)
            public map1: Map<string, any> = new Map<string, any>([
                ["1", 50],
                ["2", "test"],
                ["3", true]
            ]);

            @Property(Map)
            public map2: Map<string, any> | null = null;

            @Property(Map)
            public map3: Map<string, any> | undefined = undefined;

            @Property(Map)
            public map4: Map<string, any> = new Map();
        }
        const a = new A();
        operator.updateMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set1")).toBe("a:e:A:1:set1");
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set1")).toEqual(["i:1", "i:2", "i:3"]);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set2")).toBe("null");
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set2")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set3")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set3")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set4")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set4")).toBeUndefined();

        expect(Reflect.getMetadata(REDIS_VALUE, a, "map1")).toBe("m:e:A:1:map1");
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map1")).toEqual({
            "s:1": "i:50",
            "s:2": "s:test",
            "s:3": "b:1"
        });
        expect(Reflect.getMetadata(REDIS_VALUE, a, "map2")).toBe("null");
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map2")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "map3")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map3")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "map4")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map4")).toBeUndefined();
    });

    it("Sets metadata for single relation property", () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @RelationProperty(type => Rel)
            public rel: Rel = new Rel();
        }

        const a = new A();
        operator.updateMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "rel")).toBe("e:Rel:1");
        // doesn't update metadata in relation without cascade insert
        expect(Reflect.getMetadata(REDIS_VALUE, a.rel, "id")).toBeUndefined();
    });

    it("Sets metadata in single relations hashes when cascadeInsert/cascadeUpdate is true", () => {
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
            public rel: Rel;

            @RelationProperty(type => Rel, { cascadeUpdate: true })
            public rel2: Rel;

            @RelationProperty(type => [Rel, Rel], { cascadeInsert: true })
            public rel3: Rel | undefined = undefined;
        }

        const a = new A();
        a.rel = new Rel();
        a.rel.id = 1;
        a.rel2 = new Rel();
        a.rel2.id = 2;
        operator.updateMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "rel")).toBe("e:Rel:1");
        expect(Reflect.getMetadata(REDIS_VALUE, a.rel, "id")).toBe("i:1");
        expect(Reflect.getMetadata(REDIS_VALUE, a, "rel2")).toBe("e:Rel:2");
        expect(Reflect.getMetadata(REDIS_VALUE, a.rel2, "id")).toBe("i:2");
        expect(Reflect.getMetadata(REDIS_VALUE, a, "rel3")).toBeUndefined();
    });

    it("Sets metadata for relation map/sets", () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;
        }
        const rel = new Rel();

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @RelationProperty(type => [Rel, Set])
            public set: Set<Rel> = new Set([rel]);

            @RelationProperty(type => [Rel, Map])
            public map: Map<string, Rel> = new Map([["1", rel]]);
        }
        const a = new A();
        operator.updateMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set")).toBe("a:e:A:1:set");
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set")).toEqual(["e:Rel:1"]);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "map")).toBe("m:e:A:1:map");
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map")).toEqual({ "s:1": "e:Rel:1" });
        // doesn't set in relation itself without cascading
        expect(Reflect.getMetadata(REDIS_VALUE, rel, "id")).toBeUndefined();
    });

    it("Sets metadata for relation hashes inside relation maps/sets when cascading", () => {
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
            public set: Set<Rel> = new Set();

            @RelationProperty(type => [Rel, Map], { cascadeUpdate: true })
            public map: Map<string, Rel> = new Map();
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
        a.set.add(rel1);
        a.set.add(rel2);
        a.map.set("1", rel3);
        a.map.set("2", rel4);

        operator.updateMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, rel1, "id")).toBe("i:1");
        expect(Reflect.getMetadata(REDIS_VALUE, rel2, "id")).toBe("i:2");
        expect(Reflect.getMetadata(REDIS_VALUE, rel3, "id")).toBe("i:3");
        expect(Reflect.getMetadata(REDIS_VALUE, rel4, "id")).toBe("i:4");
    });

    it("Deletes previous metadata for undefined values", () => {
        @Entity()
        class A { 
            @IdentifyProperty()
            @TestRedisInitialValue(1)
            public id: number = 2;

            @Property(String)
            @TestRedisInitialValue("abc")
            public str: string | undefined;

            @Property(Set)
            @TestRedisInitialCollectionValue(new Set(["1", "2"]))
            public set: Set<any> | undefined;

            @Property(Map)
            @TestRedisInitialCollectionValue(new Map([["1", "abc"]]))
            public map: Map<string, any> | undefined;
        }

        const a = new A();
        operator.updateMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "id")).toBe("i:2");
        expect(Reflect.getMetadata(REDIS_VALUE, a, "str")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "map")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map")).toBeUndefined();
    });

    it("Process lazy sets/maps", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number = 1;

            @Property(LazySet)
            public set: LazySet<any> = new LazySet([1, 2, 3]);

            @Property(LazyMap)
            public map: LazyMap<number, any> = new LazyMap([[1, 1]]);
        }
        const a = new A();
        operator.updateMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set")).toBe("a:e:A:1:set");
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "map")).toBe("m:e:A:1:map");
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map")).toBeUndefined();
    });
});

describe("Reset metadata", () => {
    it("Resets metadata in hashes", () => {
        @Entity()
        class A { 
            @IdentifyProperty()
            @TestRedisInitialValue()
            public id: number = 1;

            @Property()
            @TestRedisInitialValue()
            public prop1: string = "abc";

            @Property(Set)
            @TestRedisInitialCollectionValue()
            public set1: Set<any> = new Set(["1"]);

            @Property(Map)
            @TestRedisInitialCollectionValue()
            public map1: Map<string, any> = new Map([["1", 50]]);
        }

        const a = new A();
        operator.resetMetadataInEntityObject(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "id")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop1")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set1")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "map1")).toBeUndefined();

        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set1")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map1")).toBeUndefined();
    });
});

describe("hydrateData", () => {
    it("Doesn't hydrate null or undefined values", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
        }
        const data = new Map<string, HydrationData>();
        data.set("e:A:1", { id: "e:A:1", entityClass: A, redisData: null });
        data.set("e:A:2", { id: "e:A:2", entityClass: A, redisData: undefined as any });
        data.set("a:e:A:2:map", { id: "a:e:A:2:map", redisData: undefined as any });
        data.set("a:e:A:2:map2", { id: "a:e:A:2:map2", redisData: null });
        data.set("a:e:A:2:set", { id: "a:e:A:2:set", redisData: undefined as any });
        data.set("a:e:A:2:set2", { id: "a:e:A:2:set2", redisData: null });
        const res = operator.hydrateData(data);
        expect(res).toEqual([undefined, undefined, undefined, undefined, undefined, undefined]);
    });

    it("Hydrates simple entity", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property()
            public prop1: string;

            @Property()
            public prop2: boolean;

            @Property()
            public prop3: number;

            @Property(Date)
            public prop4: Date;

            @Property()
            public prop5: string | null;

            @Property()
            public prop6: string | undefined;

            @Property("myString")
            public prop7: string;
        }

        @Entity()
        class B {
            @IdentifyProperty()
            public id: string;
        }

        const data = new Map<string, HydrationData>();
        data.set("e:A:1", {
            id: "e:A:1", entityClass: A, redisData: {
                id: "i:1",
                prop1: "s:test",
                prop2: "b:0",
                prop3: "i:10",
                prop4: "d:" + new Date(Date.UTC(2016, 10, 10, 10, 10, 10)).getTime(),
                prop5: "null",
                myString: "s:my string"
            }
        });
        data.set("e:B:2", {
            id: "e:B:2", entityClass: B, redisData: {
                id: "s:someid"
            }
        });
        const res = operator.hydrateData(data);
        expect(res).toHaveLength(2);
        const a: A = res[0];
        expect(a).toBeInstanceOf(A);
        expect(a.id).toBe(1);
        expect(a.prop1).toBe("test");
        expect(a.prop2).toBe(false);
        expect(typeof a.prop2).toBe("boolean");
        expect(a.prop3).toBe(10);
        expect(a.prop4.getTime()).toBe(new Date(Date.UTC(2016, 10, 10, 10, 10, 10)).getTime());
        expect(a.prop5).toBeNull();
        expect(a.prop6).toBeUndefined();
        expect(a.prop7).toBe("my string");

        const b: B = res[1];
        expect(b).toBeInstanceOf(B);
        expect(b.id).toBe("someid");
    });

    it("Hydrates maps and sets", () => {
        const data = new Map<string, HydrationData>();
        data.set("m:e:A:1", {
            id: "m:e:A:1", redisData: {
                "i:1": "s:some string",
                "s:1": "b:1",
                "i:2": "i:10"
            }
        });
        data.set("a:e:A:1", {
            id: "a:e:A:1", redisData: ["s:1", "i:1"]
        });

        const res = operator.hydrateData(data);
        expect(res).toHaveLength(2);
        const map: Map<any, any> = res[0];
        expect(map).toBeInstanceOf(Map);
        expect(map.get(1)).toBe("some string");
        expect(map.get("1")).toBe(true);
        expect(typeof map.get("1")).toBe("boolean");
        expect(map.get(2)).toBe(10);

        const set: Set<any> = res[1];
        expect(set).toBeInstanceOf(Set);
        expect(set.has(1)).toBeTruthy();
        expect(set.has("1")).toBeTruthy();
    });

    it("Treats empty sets as undefined", () => {
        const data = new Map<string, HydrationData>();
        data.set("a:e:A:1", {
            id: "a:e:A:1", redisData: []
        });
        const res = operator.hydrateData(data);
        expect(res[0]).toBeUndefined();
    });

    it("Hydrates entity with non relation maps and sets", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property(Map)
            public map1: Map<any, any>;

            @Property(Set)
            public set1: Set<any>;

            @Property(Map)
            public map2: Map<any, any>;

            @Property(Set)
            public set2: Set<any>;
        }

        const data = new Map<string, HydrationData>();
        data.set("e:A:1", {
            id: "e:A:1", entityClass: A, redisData: {
                id: "i:1",
                map1: "m:e:A:1:map1",
                set1: "a:e:A:1:set1",
                map2: "m:e:A:1:map2",
                set2: "a:e:A:1:set2",
            }
        });
        data.set("m:e:A:1:map1", {
            id: "m:e:A:1:map1", redisData: {
                "i:1": "s:val"
            }
        });
        data.set("a:e:A:1:set1", {
            id: "a:e:A:1:set1", redisData: [
                "s:val"
            ]
        });
        const res = operator.hydrateData(data);
        const a: A = res.find(v => v instanceof A);
        expect(a.map1).toBeInstanceOf(Map);
        expect(a.set1).toBeInstanceOf(Set);
        expect(a.map2).toBeUndefined();
        expect(a.set2).toBeUndefined();
        expect(a.map1.get(1)).toBe("val");
        expect(a.set1.has("val")).toBeTruthy();
    });

    it("Hydrates entity with single relation", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property()
            public aProp: string;
        }

        @Entity()
        class B {
            @IdentifyProperty()
            public id: number;

            @Property()
            public bProp: string;

            @RelationProperty(type => A)
            public aRel: A;
        }

        @Entity()
        class C {
            @IdentifyProperty()
            public id: number;

            @Property()
            public cProp: string;

            @RelationProperty(type => B)
            public bRel: B;
        }

        const data = new Map<string, HydrationData>();
        data.set("e:C:1", {
            id: "e:C:1", entityClass: C, redisData: {
                id: "i:1",
                cProp: "s:c prop 1",
                bRel: "e:B:1"
            }
        });
        data.set("e:C:2", {
            id: "e:C:2", entityClass: C, redisData: {
                id: "i:2",
                cProp: "s:c prop 2",
                bRel: "e:B:2"
            }
        });
        data.set("e:B:1", {
            id: "e:B:1", entityClass: B, redisData: {
                id: "i:1",
                bProp: "s:b prop 1",
                aRel: "e:A:1"
            }
        });
        data.set("e:B:2", {
            id: "e:B:2", entityClass: B, redisData: {
                id: "i:2",
                bProp: "s:b prop 2",
                aRel: "e:A:1"
            }
        });
        data.set("e:A:1", {
            id: "e:A:1", entityClass: A, redisData: {
                id: "i:1",
                aProp: "s:a prop"
            }
        });
        const res = operator.hydrateData(data);
        expect(res).toHaveLength(5);
        const [c1, b1, a1, c2, b2]: [C, B, A, C, B] = res as any;
        expect(c1).toBeInstanceOf(C);
        expect(c1.id).toBe(1);
        expect(c1.cProp).toBe("c prop 1");
        expect(c1.bRel).toBe(b1);
        expect(c1.bRel.aRel).toBe(a1);
        expect(c2).toBeInstanceOf(C);
        expect(c2.id).toBe(2);
        expect(c2.cProp).toBe("c prop 2");
        expect(c2.bRel).toBe(b2);
        expect(c2.bRel.aRel).toBe(a1);
        expect(b1).toBeInstanceOf(B);
        expect(b1.id).toBe(1);
        expect(b1.bProp).toBe("b prop 1");
        expect(b1.aRel).toBe(a1);
        expect(b2).toBeInstanceOf(B);
        expect(b2.id).toBe(2);
        expect(b2.bProp).toBe("b prop 2");
        expect(b2.aRel).toBe(a1);
        expect(a1).toBeInstanceOf(A);
        expect(a1.id).toBe(1);
        expect(a1.aProp).toBe("a prop");
    });

    it("Hydrates circular relations", () => {
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

        const aMetadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, A);
        aMetadata.push({
            isRelation: true,
            propertyName: "b",
            propertyRedisName: "b",
            propertyType: B,
            relationTypeFunc: () => B,
            isIdentifyColumn: false,
            relationOptions: { cascadeInsert: false, cascadeUpdate: false }
        });
        const bMetadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, B);
        bMetadata.push({
            isRelation: true,
            propertyName: "a",
            propertyRedisName: "a",
            propertyType: A,
            relationTypeFunc: () => A,
            isIdentifyColumn: false,
            relationOptions: { cascadeInsert: false, cascadeUpdate: false }
        });

        const data = new Map<string, HydrationData>();
        data.set("e:A:1", {
            id: "e:A:1", entityClass: A, redisData: {
                id: "i:1",
                b: "e:B:1"
            }
        });
        data.set("e:B:1", {
            id: "e:B:1", entityClass: B, redisData: {
                id: "i:1",
                a: "e:A:1"
            }
        });
        const res = operator.hydrateData(data);
        expect(res).toHaveLength(2);

        const a: A = res[0];
        const b: B = res[1];
        expect(a.b).toBe(b);
        expect(b.a).toBe(a);
    });

    it("Hydrates sets and maps with relations", () => {
        @Entity()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => [Rel, Set])
            public set1: Set<Rel>;

            @RelationProperty(type => [Rel, Map])
            public map1: Map<number, Rel>;
        }

        const data = new Map<string, HydrationData>();
        data.set("e:A:1", {
            id: "e:A:1", entityClass: A, redisData: {
                id: "i:1",
                set1: "a:e:A:1:set1",
                map1: "m:e:A:1:map1"
            }
        });
        data.set("a:e:A:1:set1", {
            id: "a:e:A:1:set1", redisData: [
                "e:Rel:1",
                "e:Rel:2",
                "e:Rel:3"
            ]
        });
        data.set("m:e:A:1:map1", {
            id: "m:e:A:1:map1", redisData: {
                "i:1": "e:Rel:1",
                "i:2": "null",
                "i:3": "e:Rel:3",
                "i:4": "e:Rel:4"
            }
        });
        data.set("e:Rel:1", {
            id: "e:Rel:1", entityClass: Rel, redisData: {
                id: "i:1"
            }
        });
        data.set("e:Rel:2", {
            id: "e:Rel:2", entityClass: Rel, redisData: {
                id: "i:2"
            }
        });
        data.set("e:Rel:3", {
            id: "e:Rel:3", entityClass: Rel, redisData: {
                id: "i:3"
            }
        });
        const res = operator.hydrateData(data);
        const a1: A = res.find(v => v instanceof A)!;
        expect(a1.map1).toBeInstanceOf(Map);
        expect(a1.set1).toBeInstanceOf(Set);
        expect(a1.set1.size).toBe(3);
        const rels = [...a1.set1.values()];
        expect(rels[0]).toBeInstanceOf(Rel);
        expect(rels[1]).toBeInstanceOf(Rel);
        expect(rels[2]).toBeInstanceOf(Rel);
        expect(a1.map1.get(1)!.id).toBe(1);
        expect(a1.map1.get(2)).toBeNull();
        expect(a1.map1.get(3)!.id).toBe(3);
        expect(a1.map1.has(4)).toBeTruthy();
        expect(a1.map1.get(4)).toBeUndefined();
    });
});
