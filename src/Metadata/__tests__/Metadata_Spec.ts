import { Entity } from "../../Decorators/Entity";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { RelationProperty } from "../../Decorators/RelationProperty";
import { ShouldThrowError } from "../../testutils/ShouldThrowError";
import { getEntityId, getEntityName, getEntityProperties, getRelationType, isRedisEntity, RelationPropertyMetadata } from "../Metadata";

describe("isRedisHash()", () => {
    it("returns false for non objects", () => {
        expect(isRedisEntity(null as any)).toBeFalsy();
        expect(isRedisEntity(undefined as any)).toBeFalsy();
        expect(isRedisEntity(0 as any)).toBeFalsy();
        expect(isRedisEntity("" as any)).toBeFalsy();
        expect(isRedisEntity(Symbol() as any)).toBeFalsy();
        expect(isRedisEntity(true as any)).toBeFalsy();
    });

    it("returns false non non redis hash classes instances and simple objects", () => {
        class A { }
        expect(isRedisEntity(new A())).toBeFalsy();
        expect(isRedisEntity({})).toBeFalsy();
    });

    it("returns true for redis hash class instances", () => {
        @Entity()
        class A { }
        expect(isRedisEntity(new A())).toBeTruthy();
    });
});

describe("getRedisHashId()", () => {
    it("returns undefined for non redis hashes", () => {
        class A { }
        expect(getEntityId(new A())).toBeUndefined();
        expect(getEntityId({})).toBeUndefined();
        expect(getEntityId(null as any)).toBeUndefined();
    });

    it("returns undefined if redis hash doesn't contain identify property", () => {
        @Entity()
        class A {
            @Property(String)
            public prop: string = "a";
        }
        expect(getEntityId(new A())).toBeUndefined();
    });

    it("returns undefined if identify property is not string or number", () => {
        @Entity()
        class A {
            @IdentifyProperty(String)
            public prop: string = new Date() as any;
        }
        expect(getEntityId(new A())).toBeUndefined();
    });

    it("returns id", () => {
        @Entity()
        class A {
            @IdentifyProperty(String)
            public prop: string = "abc";
        }
        @Entity()
        class B {
            @IdentifyProperty(Number)
            public prop: number = 5;
        }
        expect(getEntityId(new A())).toBe("abc");
        expect(getEntityId(new B())).toBe(5);
    });
});

describe("getRedisHashName()", () => {
    it("Returns undefined for non hashes", () => {
        class A { }
        expect(getEntityName(new A())).toBeUndefined();
        expect(getEntityName(A)).toBeUndefined();
        expect(getEntityName({})).toBeUndefined();
    });

    it("Returns redis hash name either for class or object", () => {
        @Entity()
        class A { }

        @Entity("test")
        class B { }
        expect(getEntityName(new A())).toBe("A");
        expect(getEntityName(A)).toBe("A");
        expect(getEntityName(new B())).toBe("test");
        expect(getEntityName(B)).toBe("test");
    });
});

describe("getRedisHashProperties()", () => {
    it("Returns properties for even hash instance or hash constructor", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;
            @Property()
            public prop2: string;
        }
        expect(getEntityProperties(A)).toMatchSnapshot();
        expect(getEntityProperties(new A())).toMatchSnapshot();
    });

    it("Returns undefined for non hashes", () => {
        class A { }
        expect(getEntityProperties({})).toBeUndefined();
        expect(getEntityProperties(A)).toBeUndefined();
    });
});

describe("getRelationType", () => {
    it("Throws if given metadata is not a relation", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @Property()
            public test: string;
        }

        const metadata = getEntityProperties(A)!.find(m => m.propertyName === "test") as RelationPropertyMetadata;

        try {
            getRelationType(A, metadata);
            throw new ShouldThrowError();
        } catch (e) {
            if (e instanceof ShouldThrowError) { throw e; }
        }
    });

    it("Throws if relation type is not a function", () => {
        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => "" as any)
            public test: string;

            @RelationProperty(type => ["" as any, String])
            public test2: string;
        }

        const metadata = getEntityProperties(A)!.find(m => m.propertyName === "test") as RelationPropertyMetadata;
        const metadata2 = getEntityProperties(A)!.find(m => m.propertyName === "test2") as RelationPropertyMetadata;

        try {
            getRelationType(A, metadata);
            throw new ShouldThrowError();
        } catch (e) {
            if (e instanceof ShouldThrowError) { throw e; }
        }
        try {
            getRelationType(A, metadata2);
            throw new ShouldThrowError();
        } catch (e) {
            if (e instanceof ShouldThrowError) { throw e; }
        }
    });

    it("Throws if relation class is not entity", () => {
        class Rel { }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => Rel)
            public test: Rel;
        }

        const metadata = getEntityProperties(A)!.find(m => m.propertyName === "test") as RelationPropertyMetadata;
        try {
            getRelationType(A, metadata);
            throw new ShouldThrowError();
        } catch (e) {
            if (e instanceof ShouldThrowError) { throw e; }
        }
    });

    it("Returns relation type", () => {
        @Entity()
        class B { 
            @IdentifyProperty()
            public id: number;
        }

        @Entity()
        class A {
            @IdentifyProperty()
            public id: number;

            @RelationProperty(type => B)
            public test: B;

            @RelationProperty(type => [B, Set])
            public test2: Set<B>;
        }

        const metadata = getEntityProperties(A)!.find(m => m.propertyName === "test") as RelationPropertyMetadata;
        const metadata2 = getEntityProperties(A)!.find(m => m.propertyName === "test2") as RelationPropertyMetadata;

        expect(getRelationType(A, metadata)).toBe(B);
        expect(getRelationType(A, metadata2)).toBe(B);
    });
});