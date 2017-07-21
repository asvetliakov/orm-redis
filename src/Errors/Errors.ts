export class AlreadyConnectedError extends Error {
    public constructor() {
        super("Already connected to Redis");
    }
}

export class MetadataError extends Error {
    public constructor(entity: Function, msg: string) {
        super(`Metadata error for ${entity.name}: ${msg}`);
    }
}

export class DuplicateIdsInEntityError extends Error {
    public constructor(entity: object, id: string) {
        super(`Entity of type ${entity.constructor.name} with same IDs: ${id} but with different object links were found`);
    }
}