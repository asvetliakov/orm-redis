import { REDIS_HASH } from "../../Metadata/Metadata";
import { Hash } from "../Hash";

@Hash()
class Test {}

@Hash("somename")
class Test2 { }

it("Defines metadata", () => {
    expect(Reflect.getMetadata(REDIS_HASH, Test)).toBe("Test");
    expect(Reflect.getMetadata(REDIS_HASH, Test2)).toBe("somename");
});