import { hasPrototypeOf } from "../hasPrototypeOf";

it("Works for classes", () => {
    class A { }
    class B extends A { }
    class C extends B { }
    expect(hasPrototypeOf(C, B)).toBeTruthy();
    expect(hasPrototypeOf(C, A)).toBeTruthy();
    expect(hasPrototypeOf(A, B)).toBeFalsy();

    class D extends Map { }
    class E extends D { }
    expect(hasPrototypeOf(E, D)).toBeTruthy();
    expect(hasPrototypeOf(E, Map)).toBeTruthy();
    expect(hasPrototypeOf(undefined, Map)).toBeFalsy();
});

it("Works for functions", () => {
    function A() { }
    function B() { }
    B.prototype = Object.create(A.prototype);
    B.prototype.constructor = B;
    function C() { }
    C.prototype = B;
    C.prototype = Object.create(B.prototype);
    C.prototype.constructor = C;
    expect(hasPrototypeOf(C, B)).toBeTruthy();
    expect(hasPrototypeOf(C, A)).toBeTruthy();
    expect(hasPrototypeOf(A, B)).toBeFalsy();

    function D() { }
    D.prototype = Object.create(Map.prototype);
    D.prototype.constructor = D;
    function E() { }
    E.prototype = Object.create(D.prototype);
    E.prototype.constructor = E;
    expect(hasPrototypeOf(E, D)).toBeTruthy();
    expect(hasPrototypeOf(E, Map)).toBeTruthy();
    expect(hasPrototypeOf(Object, Set)).toBeFalsy();
});