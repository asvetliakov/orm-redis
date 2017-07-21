import { Hash } from "../../Decorators/Hash";
import { IdentifyProperty } from "../../Decorators/IdentifyProperty";
import { Property } from "../../Decorators/Property";
import { getRedisHashId, getRedisHashName, isRedisHash } from "../Metadata";

describe("isRedisHash()", () => {
    it("returns false for non objects", () => {
        expect(isRedisHash(null as any)).toBeFalsy();
        expect(isRedisHash(undefined as any)).toBeFalsy();
        expect(isRedisHash(0 as any)).toBeFalsy();
        expect(isRedisHash("" as any)).toBeFalsy();
        expect(isRedisHash(Symbol() as any)).toBeFalsy();
        expect(isRedisHash(true as any)).toBeFalsy();
    });

    it("returns false non non redis hash classes instances and simple objects", () => {
        class A { }
        expect(isRedisHash(new A())).toBeFalsy();
        expect(isRedisHash({})).toBeFalsy();
    });

    it("returns true for redis hash class instances", () => {
        @Hash()
        class A { }
        expect(isRedisHash(new A())).toBeTruthy();
    });
});

describe("getRedisHashId()", () => {
    it("returns undefined for non redis hashes", () => {
        class A { }
        expect(getRedisHashId(new A())).toBeUndefined();
        expect(getRedisHashId({})).toBeUndefined();
        expect(getRedisHashId(null as any)).toBeUndefined();
    });

    it("returns undefined if redis hash doesn't contain identify property", () => {
        @Hash()
        class A {
            @Property(String)
            public prop: string = "a";
        }
        expect(getRedisHashId(new A())).toBeUndefined();
    });

    it("returns undefined if identify property is not string or number", () => {
        @Hash()
        class A {
            @IdentifyProperty(String)
            public prop: string = new Date() as any;
        }
        expect(getRedisHashId(new A())).toBeUndefined();
    });

    it("returns id", () => {
        @Hash()
        class A {
            @IdentifyProperty(String)
            public prop: string = "abc";
        }
        @Hash()
        class B {
            @IdentifyProperty(Number)
            public prop: number = 5;
        }
        expect(getRedisHashId(new A())).toBe("abc");
        expect(getRedisHashId(new B())).toBe(5);
    });
});

describe("getRedisHashName()", () => {
    it("Returns undefined for non hashes", () => {
        class A { }
        expect(getRedisHashName(new A())).toBeUndefined();
        expect(getRedisHashName(A)).toBeUndefined();
        expect(getRedisHashName({})).toBeUndefined();
    });

    it("Returns redis hash name either for class or object", () => {
        @Hash()
        class A { }

        @Hash("test")
        class B { }
        expect(getRedisHashName(new A())).toBe("A");
        expect(getRedisHashName(A)).toBe("A");
        expect(getRedisHashName(new B())).toBe("test");
        expect(getRedisHashName(B)).toBe("test");
    });
});