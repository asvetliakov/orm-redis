
export class ShouldThrowError extends Error {
    public constructor() {
        super("The test should throw");
    }
}