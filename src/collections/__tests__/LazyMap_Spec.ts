import { LazyMap } from "../LazyMap";

it("It's ordinary promised map", async () => {
    const map = new LazyMap<number, string>();
    await map.set(1, "test");
    await map.set(2, "test2");
    expect(await map.size()).toBe(2);
    expect(await map.get(1)).toBe("test");
    expect(await map.has(1)).toBeTruthy();
    await map.delete(2);
    expect(await map.has(2)).toBeFalsy();
    expect(await map.size()).toBe(1);

    await map.set(2, "test2");
    await map.set(3, "test3");

    const keys: number[] = [];
    for await (const k of map.keys()) {
        keys.push(k);
    }
    expect(keys).toEqual([1, 2, 3]);

    const values: string[] = [];
    for await (const v of map.values()) {
        values.push(v);
    }
    expect(values).toEqual(["test", "test2", "test3"]);

    const pairs: Array<[number, string]> = [];
    for await (const p of map) {
        pairs.push(p);
    }
    expect(pairs).toEqual([
        [1, "test"],
        [2, "test2"],
        [3, "test3"]
    ]);
    expect(await map.toArray()).toEqual([
        [1, "test"],
        [2, "test2"],
        [3, "test3"]
    ]);
});