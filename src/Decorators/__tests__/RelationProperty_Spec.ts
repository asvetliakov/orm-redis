import { PropertyMetadata, REDIS_PROPERTIES, RelationPropertyMetadata } from "../../Metadata/Metadata";
import { ShouldThrowError } from "../../testutils/ShouldThrowError";
import { Hash } from "../Hash";
import { RelationProperty } from "../RelationProperty";

it("Throws error if relation type is not specified", () => {
    const R = class { };
    const C = class {
        public test: typeof R;
    };
    const c = new C();
    try {
        RelationProperty(() => undefined as any)(c, "test");
        throw new ShouldThrowError();
    } catch (e) {
        if (e instanceof ShouldThrowError) { throw e; }
    }
    
    try {
        RelationProperty(() => 5 as any)(c, "test");
        throw new ShouldThrowError();
    } catch (e) {
        if (e instanceof ShouldThrowError) { throw e; }
    }
});

it("Throws if relation doesn't contain RedisHash decorator", () => {
    const R = class { };
    const C = class {
        public test: typeof R;
    };
    const c = new C();
    try {
        RelationProperty(() => R)(c, "test");
        throw new ShouldThrowError();
    } catch (e) {
        if (e instanceof ShouldThrowError) { throw e; }
    }
});

describe("Defines metadata", () => {
    @Hash()
    class Rel { }
    
    it("With default values", () => {
        @Hash()
        class C {
            @RelationProperty(() => Rel)
            public test: Rel;
        }
        const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, C);
        expect(metadata).toMatchSnapshot();
        const relMetadata: RelationPropertyMetadata = metadata[0] as RelationPropertyMetadata;
        expect(relMetadata.relationType).toBe(Rel);
        expect(relMetadata.propertyType).toBe(Rel);
    });
    
    it("With relation options", () => {
        @Hash()
        class C {
            @RelationProperty(type => Rel, { cascadeUpdate: true, propertyName: "testName" })
            public test: Rel;
        }
        const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, C);
        expect(metadata).toMatchSnapshot();
    });

    it("With explicitly specified property type", () => {
        @Hash()
        class C {
            @RelationProperty(() => [Rel, Rel])
            public test: Rel;
        }
        const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, C);
        const relMetadata: RelationPropertyMetadata = metadata[0] as RelationPropertyMetadata;
        expect(relMetadata.relationType).toBe(Rel);
        expect(relMetadata.propertyType).toBe(Rel);
    });

    it("For set or map of relations", () => {
        @Hash()
        class C {
            @RelationProperty(() => [Rel, Set])
            public test: Set<Rel>;

            @RelationProperty(() => [Rel, Map])
            public test2: Map<string, Rel>;
        }
        const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, C);
        expect(metadata).toMatchSnapshot();
        let relMetadata: RelationPropertyMetadata = metadata[0] as RelationPropertyMetadata;
        expect(relMetadata.relationType).toBe(Rel);
        expect(relMetadata.propertyType).toBe(Set);
        relMetadata = metadata[1] as RelationPropertyMetadata;
        expect(relMetadata.relationType).toBe(Rel);
        expect(relMetadata.propertyType).toBe(Map);
    });
});
