import { LazySet } from "../LazySet";

it("Ordinary set but with promised methods", async () => {
    const set = new LazySet();
    await set.add(1);
    expect(await set.has(1)).toBeTruthy();
    expect(await set.size()).toBe(1);
    await set.add(2);
    await set.add(3);
    expect(await set.size()).toBe(3);
    await set.delete(3);
    expect(await set.size()).toBe(2);

    for await (const val of set.values()) {
        expect(val).toEqual(expect.any(Number));
    }
    const iterated = [];
    for await (const val of set.values()) {
        expect(val).toEqual(expect.any(Number));
        iterated.push(val);
    }
    expect(iterated).toEqual(expect.arrayContaining([1, 2]));

    let values = await set.toArray();
    expect(values).toEqual(expect.arrayContaining([1, 2]));
    values = await set.toArray();
    expect(values).toEqual(expect.arrayContaining([1, 2]));
});