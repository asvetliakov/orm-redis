import { Hash } from "../../Decorators/Hash";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { RelationProperty } from "../../Decorators/RelationProperty";
import { DuplicateIdsInEntityError, MetadataError } from "../../Errors/Errors";
import { REDIS_COLLECTION_VALUE, REDIS_VALUE } from "../../Metadata/Metadata";
import { ShouldThrowError } from "../../testutils/ShouldThrowError";
import { TestRedisInitialCollectionValue, TestRedisInitialValue } from "../../testutils/TestDecorators";
import { Operator } from "../Operator";

let operator: Operator;

beforeEach(() => {
    operator = new Operator();
});

describe("Save/Delete/Update", () => {
    it("Throws error if class is not decorated with @Hash", () => {
        class A { }
        try {
            operator.getSaveOperation(new A());
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

    it("Throws error if class doesn't contain any @Property decorator", () => {
        @Hash()
        class A { }

        try {
            operator.getSaveOperation(new A());
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

    it("Throws error if class doesn't contain @IdentifyProperty decorator", () => {
        @Hash()
        class A {
            @Property(Number)
            public prop: number;
        }
        try {
            operator.getSaveOperation(new A());
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

    it("Throws error if @IdentifyProperty is not a number or string", () => {
        @Hash()
        class A {
            @IdentifyProperty(Number)
            public prop: number; // undefined
        }
        const a = new A();
        try {
            operator.getSaveOperation(a);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }
        try {
            a.prop = new Date() as any;
            operator.getSaveOperation(a);
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

    it("Process simple properties", () => {
        @Hash()
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
        let res = operator.getSaveOperation(a);
        expect(res).toMatchSnapshot();

        res = operator.getDeleteOperation(a);
        expect(res).toMatchSnapshot();
    });

    it("Process Map and Sets in properties", () => {
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
        @Hash()
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
        const res = operator.getSaveOperation(a);
        expect(res).toMatchSnapshot();
    });

    it("Simple values and updating/deleting over existing redis value", () => {
        @Hash()
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

        const res = operator.getSaveOperation(a);
        expect(res).toMatchSnapshot();
    });

    describe("Simple map and sets changing and updating", () => {
        @Hash()
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

        it("Changing", () => {
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

            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Deleting entity with related maps/sets", () => {
            const a = new A();
            const res = operator.getDeleteOperation(a);
            expect(res).toMatchSnapshot();
        });
    });


    describe("Single relation", () => {
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;

            @Property()
            public relTest: string = "test";
        }
        it("Saves new relation without cascade inserting", () => {
            @Hash()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel)
                public rel: Rel = new Rel();
            }
            const a = new A();
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Saves new relation with cascade inserting", () => {
            @Hash()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel, { cascadeInsert: true })
                public rel: Rel = new Rel();
            }
            const a = new A();
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Saves new relation over previous relation without cascade inserting", () => {
            const rel = new Rel();
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Throws if relation is invalid", () => {
            @Hash()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel)
                public rel: Rel;
            }
            class B { }
            @Hash()
            class C { 
                @Property()
                public prop: string = "";
            }

            const a = new A();
            a.rel = {} as any;
            try {
                operator.getSaveOperation(a);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(MetadataError);
            }
            a.rel = new B() as any;
            try {
                operator.getSaveOperation(a);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(MetadataError);
            }
            a.rel = new C() as any;
            try {
                operator.getSaveOperation(a);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(MetadataError);
            }
        });

        it("Saves new relation over previous relation with cascade inserting", () => {
            const rel = new Rel();
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Change in relation without cascade update", () => {
            const rel = new Rel();
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Change in relation with cascade update", () => {
            const rel = new Rel();
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Set relation to null", () => {
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Set relation to undefined", () => {
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Set relation from null to undefined", () => {
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Update relation without cascadeUpdate", () => {
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Update relation with cascadeUpdate", () => {
            const rel = new Rel();
            TestRedisInitialValue(1)(rel, "id");
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Delete with relation doesn't delete relation itself", () => {
            const rel = new Rel();
            TestRedisInitialValue(1)(rel, "id");
            @Hash()
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

        it("Prevents circular references when inserting", () => {
            @Hash()
            class A { 
                @IdentifyProperty()
                public id: number = 1;

                public bTest: B;
            }

            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Prevents circular references when updating", () => {
            @Hash()
            class A { 
                @IdentifyProperty()
                @TestRedisInitialValue()
                public id: number = 1;

                public bTest: B;
            }

            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        describe("Complex and nested relations and cascade ops", () => {
            @Hash()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public text: string = "another rel";
            }

            @Hash()
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

            @Hash()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                @RelationProperty(type => Rel, { cascadeInsert: true,  cascadeUpdate: true })
                public rel: Rel = new Rel();
            }

            it("Insert", () => {
                const a = new A();
                const res = operator.getSaveOperation(a);
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

            it("Updating", () => {
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
                let res = operator.getSaveOperation(a);
                expect(res).toMatchSnapshot();

                const newAnotherRel = new AnotherRel();
                newAnotherRel.id = 2;
                newAnotherRel.text = "new text";
                a.rel.anotherRel = newAnotherRel;
                res = operator.getSaveOperation(a);
                // must not delete AnotherRel:1
                expect(res).toMatchSnapshot();

                const newRel = new Rel();
                newRel.map1.clear();
                newRel.set1.clear();
                newRel.id = 2;
                a.rel = newRel;
                res = operator.getSaveOperation(a);
                expect(res).toMatchSnapshot();
            });
        });
    });

    describe("Multiple relations in sets", () => {
        it("Save hash with relation in sets without cascade insert", () => {
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save hash with relation in sets with cascade insert", () => {
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save nested relations in sets with cascade insert", () => {
            @Hash()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public prop: string = "another rel";
            }
            const anotherRel = new AnotherRel();
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;

                @RelationProperty(type => AnotherRel, { cascadeInsert: true })
                public insideRel: AnotherRel = anotherRel;
            }

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save cyclic relations with cascade insert", () => {
            @Hash()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                public bSet: Set<B>;
            }
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Tracks deletion/addition of relations in set", () => {
            @Hash()
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

            @Hash()
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

            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Tracks changes in relations with cascadeUpdate", () => {
            @Hash()
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

            @Hash()
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

            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Works when replacing relation set with new object", () => {
            @Hash()
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

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Throws error if there are objects with same id but have different object links in relation set", () => {
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Hash()
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
                operator.getSaveOperation(e);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(DuplicateIdsInEntityError);
            }
        });

        describe("Has different objects with same id in deep relation", () => {
            @Hash()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public prop: string = "another rel";
            }
            @Hash()
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
                @Hash()
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

            it("throws if saving with cascade insert", () => {
                RelationProperty(type => [Rel, Set], { cascadeInsert: true })(e, "rels");
                try {
                    operator.getSaveOperation(e);
                    throw new ShouldThrowError();
                } catch (e) {
                    expect(e).toBeInstanceOf(DuplicateIdsInEntityError);
                }
            });

            it("doesn't throws if saving without cascade insert", () => {
                RelationProperty(type => [Rel, Set])(e, "rels");
                operator.getSaveOperation(e);
            });
        });
    });

    describe("Multiple relations in maps", () => {
        it("Save hash with relation in maps without cascade insert", () => {
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save hash with relation in maps with cascade insert", () => {
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Allows multiple keys to same relation object", () => {
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save nested relations in maps with cascade insert", () => {
            @Hash()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public prop: string = "another rel";
            }
            const anotherRel = new AnotherRel();
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;

                @RelationProperty(type => AnotherRel, { cascadeInsert: true })
                public insideRel: AnotherRel = anotherRel;
            }

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Save cyclic relations with cascade insert", () => {
            @Hash()
            class A {
                @IdentifyProperty()
                public id: number = 1;

                public bMap: Map<number, B>;
            }
            @Hash()
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
            const res = operator.getSaveOperation(a);
            expect(res).toMatchSnapshot();
        });

        it("Tracks deletion/addition of relations in relation map", () => {
            @Hash()
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

            @Hash()
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

            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Tracks changes in relations with cascadeUpdate", () => {
            @Hash()
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

            @Hash()
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

            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Works when replacing relation map with new object", () => {
            @Hash()
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

            @Hash()
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
            const res = operator.getSaveOperation(e);
            expect(res).toMatchSnapshot();
        });

        it("Throws error if there are objects with same id but have different object links in relation map", () => {
            @Hash()
            class Rel {
                @IdentifyProperty()
                public id: number;

                @Property()
                public prop: string;
            }

            @Hash()
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
                operator.getSaveOperation(e);
                throw new ShouldThrowError();
            } catch (e) {
                expect(e).toBeInstanceOf(DuplicateIdsInEntityError);
            }
        });

        describe("Has different objects with same id in deep relation", () => {
            @Hash()
            class AnotherRel {
                @IdentifyProperty()
                public id: number = 1;

                @Property()
                public prop: string = "another rel";
            }
            @Hash()
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
                @Hash()
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

            it("throws if saving with cascade insert", () => {
                RelationProperty(type => [Rel, Map], { cascadeInsert: true })(e, "rels");
                try {
                    operator.getSaveOperation(e);
                    throw new ShouldThrowError();
                } catch (e) {
                    expect(e).toBeInstanceOf(DuplicateIdsInEntityError);
                }
            });

            it("doesn't throws if saving without cascade insert", () => {
                RelationProperty(type => [Rel, Map])(e, "rels");
                operator.getSaveOperation(e);
            });
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

        @Hash()
        class B { }
        try {
            operator.getLoadOperation("test", B);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        @Hash()
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
        @Hash()
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
        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty(Number)
            public id: number;
        }
        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty(Number)
            public id: number;
        }
        @Hash()
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

        @Hash()
        class B { }
        try {
            operator.updateMetadataInHash(B);
            throw new ShouldThrowError();
        } catch (e) {
            expect(e).toBeInstanceOf(MetadataError);
        }

        @Hash()
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
        @Hash()
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
        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;
        }

        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }

        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number = 1;
        }
        const rel = new Rel();

        @Hash()
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
        @Hash()
        class Rel {
            @IdentifyProperty()
            public id: number;
        }

        @Hash()
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
        @Hash()
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
});

describe("Reset metadata", () => {
    it("Resets metadata in hashes", () => {
        @Hash()
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
        operator.resetMetadataInHash(a);
        expect(Reflect.getMetadata(REDIS_VALUE, a, "id")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "prop1")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "set1")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_VALUE, a, "map1")).toBeUndefined();

        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "set1")).toBeUndefined();
        expect(Reflect.getMetadata(REDIS_COLLECTION_VALUE, a, "map1")).toBeUndefined();
    });
});