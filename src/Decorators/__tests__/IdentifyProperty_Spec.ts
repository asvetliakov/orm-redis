import { REDIS_PROPERTIES } from "../../Metadata/Metadata";
import { ShouldThrowError } from "../../testutils/ShouldThrowError";
import { Entity } from "../Entity";
import { IdentifyProperty } from "../IdentifyProperty";

@Entity()
class Test {
    @IdentifyProperty(String)
    public id: string;
}

@Entity()
class Test2 {
    @IdentifyProperty("somename")
    public id: number;
}

class Invalid1 {
    public id: Date;
}

class Invalid2 {
    public id: Object;
}

it("Throws error if type of property is not number or string", () => {
    try {
        const test = new Invalid1();
        IdentifyProperty(Date as any)(test, "id");
        throw new ShouldThrowError();
    } catch (e) {
        if (e instanceof ShouldThrowError) { throw e; }
    }
    try {
        const test = new Invalid2();
        IdentifyProperty(Object as any)(test, "id");
        throw new ShouldThrowError();
    } catch (e) {
        if (e instanceof ShouldThrowError) { throw e; }
    }
});

it("Defines metadata without custom name", () => {
    const metadata = Reflect.getMetadata(REDIS_PROPERTIES, Test);
    expect(metadata).toMatchSnapshot();
});

it("Defines metadata with custom name", () => {
    const metadata = Reflect.getMetadata(REDIS_PROPERTIES, Test2);
    expect(metadata).toMatchSnapshot();
});