import { REDIS_ENTITY } from "../../Metadata/Metadata";
import { Entity } from "../Entity";

@Entity()
class Test {}

@Entity("somename")
class Test2 { }

it("Defines metadata", () => {
    expect(Reflect.getMetadata(REDIS_ENTITY, Test)).toBe("Test");
    expect(Reflect.getMetadata(REDIS_ENTITY, Test2)).toBe("somename");
});