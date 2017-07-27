import { PropertyMetadata, REDIS_PROPERTIES, RelationPropertyMetadata } from "../../Metadata/Metadata";
import { Entity } from "../Entity";
import { RelationProperty } from "../RelationProperty";
@Entity()
class Rel { }

it("With default values", () => {
    @Entity()
    class C {
        @RelationProperty(() => Rel)
        public test: Rel;
    }
    const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, C);
    expect(metadata).toMatchSnapshot();
    const relMetadata: RelationPropertyMetadata = metadata[0] as RelationPropertyMetadata;
    expect(relMetadata.relationTypeFunc()).toBe(Rel);
    expect(relMetadata.propertyType).toBe(Rel);
});

it("With relation options", () => {
    @Entity()
    class C {
        @RelationProperty(type => Rel, { cascadeUpdate: true, propertyName: "testName" })
        public test: Rel;
    }
    const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, C);
    expect(metadata).toMatchSnapshot();
});

it("With explicitly specified property type", () => {
    @Entity()
    class C {
        @RelationProperty(() => [Rel, Rel])
        public test: Rel;
    }
    const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, C);
    const relMetadata: RelationPropertyMetadata = metadata[0] as RelationPropertyMetadata;
    expect(relMetadata.relationTypeFunc()).toEqual([Rel, Rel]);
    expect(relMetadata.propertyType).toBe(Rel);
});

it("For set or map of relations", () => {
    @Entity()
    class C {
        @RelationProperty(() => [Rel, Set])
        public test: Set<Rel>;

        @RelationProperty(() => [Rel, Map])
        public test2: Map<string, Rel>;
    }
    const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, C);
    expect(metadata).toMatchSnapshot();
    let relMetadata: RelationPropertyMetadata = metadata[0] as RelationPropertyMetadata;
    expect(relMetadata.relationTypeFunc()).toEqual([Rel, Set]);
    expect(relMetadata.propertyType).toBe(Set);
    relMetadata = metadata[1] as RelationPropertyMetadata;
    expect(relMetadata.relationTypeFunc(0)).toEqual([Rel, Map]);
    expect(relMetadata.propertyType).toBe(Map);
});