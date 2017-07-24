import { Entity } from "../../Decorators/Entity";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { getEntityId, getEntityName, getEntityProperties, isRedisEntity } from "../Metadata";

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