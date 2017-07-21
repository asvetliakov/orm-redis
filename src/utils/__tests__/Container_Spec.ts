import { ContainerInterface, getFromContainer, useContainer } from "../Container";

class Test {}

it("Should create instance from default container", () => {
    const t = getFromContainer(Test);
    expect(t).toBeInstanceOf(Test);
    
    const k = getFromContainer(Test);
    expect(k).toBe(t);
});

it("Should create instance from user container", () => {
    const container: ContainerInterface = {
        get: jest.fn().mockImplementation((cl: any) => new cl())
    };
    useContainer(container);
    
    const ins = getFromContainer(Test);
    expect(ins).toBeInstanceOf(Test);
    expect(container.get).toBeCalledWith(Test);
});
