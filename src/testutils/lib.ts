// See https://github.com/Microsoft/TypeScript/issues/16872
// USE ONLY IN TESTS

const MyMap = Map;
const MySet = Set;
const MyInt8Array = Int8Array;
const MyDate = Date;

export { MyMap as Map };
export { MySet as Set };
export { MyInt8Array as Int8Array };
export { MyDate as Date };