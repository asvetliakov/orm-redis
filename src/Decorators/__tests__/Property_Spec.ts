import { PropertyMetadata, REDIS_PROPERTIES } from "../../Metadata/Metadata";
import { Property } from "../Property";

// class Internal { }

class Test { 
    @Property()
    public one: string;
    @Property("twoName")
    public two: number;
    @Property(Date)
    public three: Date;
    @Property()
    public four: Object;
    @Property("fiveName")
    public five: { id: string };
    @Property()
    public six: boolean;
    // @Property(Int8Array, "sevenName")
    // public seven: Int8Array;
    @Property(Set)
    public eight: Set<string>;
    @Property("nineName", Map)
    public nine: Map<any, any>;
    // @Property()
    // public ten: Internal;
    @Property()
    public eleven: string[];
    
    public nonRedis1: string;
    public nonRedis2: number;
}

it("Defines metadata", () => {
    const metadata: PropertyMetadata[] = Reflect.getMetadata(REDIS_PROPERTIES, Test);
    expect(metadata).toHaveLength(9);
    const [one, two, three, four, five, six, /* seven, */ eight, nine, /* ten, */eleven] = metadata;
    expect(metadata).toMatchSnapshot();
    expect(one.propertyType).toBe(String);
    expect(two.propertyType).toBe(Number);
    expect(three.propertyType).toBe(Date);
    expect(four.propertyType).toBe(Object);
    expect(five.propertyType).toBe(Object);
    expect(six.propertyType).toBe(Boolean);
    // expect(seven.propertyType).toBe(Int8Array);
    expect(eight.propertyType).toBe(Set);
    expect(nine.propertyType).toBe(Map);
    // expect(ten.propertyType).toBe(Internal);
    expect(eleven.propertyType).toBe(Array);
});