/**
 * Base error class
 * 
 * @export
 * @class OrmRedisError
 */
export class OrmRedisError extends Error { }

/**
 * Calling connect in conenction when it's already connected
 * 
 * @export
 * @class AlreadyConnectedError
 */
export class AlreadyConnectedError extends OrmRedisError {
    public constructor() {
        super("Already connected to Redis");
    }
}

/**
 * Trying to create new connection when there is already connection exists with same name
 * 
 * @export
 * @class ConnectionAlreadyExistError
 */
export class ConnectionAlreadyExistError extends OrmRedisError {
    /**
     * Creates an instance of ConnectionAlreadyExist.
     * @param name Connection name
     */
    public constructor(name: string) {
        super(`The connection with name: ${name} is already exists`);
    }
}

/**
 * Trying to obtain non existed connection
 * 
 * @export
 * @class NoSuchConnectionError
 */
export class NoSuchConnectionError extends OrmRedisError {
    /**
     * Creates an instance of NoSuchConnectionError.
     * @param name 
     */
    public constructor(name: string) {
        super(`The connection with name: ${name} doesn't exist`);
    }
}

/**
 * General metadata error
 * 
 * @export
 * @class MetadataError
 */
export class MetadataError extends OrmRedisError {
    public constructor(entity: Function, msg: string) {
        super(`Metadata error for ${entity.name}: ${msg}`);
    }
}

export class DuplicateIdsInEntityError extends OrmRedisError {
    public constructor(entity: object, id: string) {
        super(`Entity of type ${entity.constructor.name} with same IDs: ${id} but with different object links were found`);
    }
}