import { RedisClient, ServerInfo } from "redis";
import { promisifyAll } from "sb-promisify";

export interface PromisedOverloadedCommand<T, U> {
    (args: T[]): Promise<U>;
    (arg: T, args: T[]): Promise<U>;

    (arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): Promise<U>;
    (arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, ): Promise<U>;
    (arg1: T, arg2: T, arg3: T, arg4: T): Promise<U>;
    (arg1: T, arg2: T, arg3: T): Promise<U>;
    (arg1: T, arg2: T): Promise<U>;
    (arg1: T): Promise<U>;
    (...args: T[]): Promise<U>;
}

export interface PromisedOverloadedKeyCommand<T, U> {
    (key: string, args: T[]): Promise<U>;

    (key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): Promise<U>;
    (key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T): Promise<U>;
    (key: string, arg1: T, arg2: T, arg3: T, arg4: T): Promise<U>;
    (key: string, arg1: T, arg2: T, arg3: T): Promise<U>;
    (key: string, arg1: T, arg2: T): Promise<U>;
    (key: string, arg1: T): Promise<U>;
    (key: string, ...args: T[]): Promise<U>;
}

export interface PromisedOverloadedListCommand<T, U> {
    (args: T[]): Promise<U>;

    (arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): Promise<U>;
    (arg1: T, arg2: T, arg3: T, arg4: T, arg5: T): Promise<U>;
    (arg1: T, arg2: T, arg3: T, arg4: T): Promise<U>;
    (arg1: T, arg2: T, arg3: T): Promise<U>;
    (arg1: T, arg2: T): Promise<U>;
    (arg1: T): Promise<U>;
    (...args: T[]): Promise<U>;
}

export interface PromisedOverloadedSetCommand<T, U> {
    (key: string, args: { [key: string]: T } | T[]): Promise<U>;

    (key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T, arg6: T): Promise<U>;
    (key: string, arg1: T, arg2: T, arg3: T, arg4: T, arg5: T): Promise<U>;
    (key: string, arg1: T, arg2: T, arg3: T, arg4: T): Promise<U>;
    (key: string, arg1: T, arg2: T, arg3: T): Promise<U>;
    (key: string, arg1: T, arg2: T): Promise<U>;
    (key: string, arg1: T): Promise<U>;
    (key: string, ...args: T[]): Promise<U>;
}

export interface PromisedOverloadedLastCommand<T1, T2, U> {
    (args: Array<T1 | T2>): Promise<U>;
    (arg: T1, args: Array<T1 | T2>): Promise<U>;

    (arg1: T1, arg2: T1, arg3: T1, arg4: T1, arg5: T1, arg6: T2): Promise<U>;
    (arg1: T1, arg2: T1, arg3: T1, arg4: T1, arg5: T2): Promise<U>;
    (arg1: T1, arg2: T1, arg3: T1, arg4: T2): Promise<U>;
    (arg1: T1, arg2: T1, arg3: T2): Promise<U>;
    (arg1: T1, arg2: T2): Promise<U>;
    (...args: Array<T1 | T2>): Promise<U>;
}

// tslint:disable:member-ordering
export interface PromisedCommands {
    /**
     * Listen for all requests received by the server in real time.
     */
    monitorAsync(): Promise<void>;

    /**
     * Get information and statistics about the server.
     */
    infoAsync(): Promise<ServerInfo>;
    infoAsync(section?: string | string[]): Promise<ServerInfo>;

    /**
     * Ping the server.
     */
    pingAsync(message: string): Promise<string>;

    /**
     * Post a message to a channel.
     */
    publishAsync(channel: string, value: string): Promise<number>;

    /**
     * Authenticate to the server.
     */
    authAsync(password: string): Promise<string>;

    /**
     * KILL - Kill the connection of a client.
     * LIST - Get the list of client connections.
     * GETNAME - Get the current connection name.
     * PAUSE - Stop processing commands from clients for some time.
     * REPLY - Instruct the server whether to reply to commands.
     * SETNAME - Set the current connection name.
     */
    clientAsync: PromisedOverloadedCommand<string, any>;


    /**
     * Set multiple hash fields to multiple values.
     */
    hmsetAsync: PromisedOverloadedSetCommand<string | number, boolean>;

    /**
     * Listen for messages published to the given channels.
     */
    subscribeAsync: PromisedOverloadedListCommand<string, string>;

    /**
     * Stop listening for messages posted to the given channels.
     */
    unsubscribeAsync: PromisedOverloadedListCommand<string, string>;

    /**
     * Listen for messages published to channels matching the given patterns.
     */
    psubscribeAsync: PromisedOverloadedListCommand<string, string>;

    /**
     * Stop listening for messages posted to channels matching the given patterns.
     */
    punsubscribeAsync: PromisedOverloadedListCommand<string, string>;

    /**
     * Append a value to a key.
     */
    appendAsync(key: string, value: string): Promise<number>;

    /**
     * Asynchronously rewrite the append-only file.
     */
    bgrewriteaofAsync(): Promise<"OK">;

    /**
     * Asynchronously save the dataset to disk.
     */
    bgsaveAsync(): Promise<string>;

    /**
     * Count set bits in a string.
     */
    bitcountAsync(key: string): Promise<number>;
    bitcountAsync(key: string, start: number, end: number): Promise<number>;

    /**
     * Perform arbitrary bitfield integer operations on strings.
     */
    bitfieldAsync: PromisedOverloadedKeyCommand<string | number, [number, number]>;

    /**
     * Perform bitwise operations between strings.
     */
    bitopAsync(operation: string, destkey: string, key1: string, key2: string, key3: string): Promise<number>;
    bitopAsync(operation: string, destkey: string, key1: string, key2: string): Promise<number>;
    bitopAsync(operation: string, destkey: string, key: string): Promise<number>;
    bitopAsync(operation: string, destkey: string, ...args: string[]): Promise<number>;

    /**
     * Find first bit set or clear in a string.
     */
    bitposAsync(key: string, bit: number, start: number, end: number): Promise<number>;
    bitposAsync(key: string, bit: number, start: number): Promise<number>;
    bitposAsync(key: string, bit: number): Promise<number>;

    /**
     * Remove and get the first element in a list, or block until one is available.
     */
    blpopAsync: PromisedOverloadedLastCommand<string, number, [string, string]>;

    /**
     * Remove and get the last element in a list, or block until one is available.
     */
    brpopAsync: PromisedOverloadedLastCommand<string, number, [string, string]>;

    /**
     * Pop a value from a list, push it to another list and return it; or block until one is available.
     */
    brpoplpushAsync(source: string, destination: string, timeout: number): Promise<[string, string]>;

    /**
     * ADDSLOTS - Assign new hash slots to receiving node.
     * COUNT-FAILURE-REPORTS - Return the number of failure reports active for a given node.
     * COUNTKEYSINSLOT - Return the number of local keys in the specified hash slot.
     * DELSLOTS - Set hash slots as unbound in receiving node.
     * FAILOVER - Forces a slave to perform a manual failover of its master.
     * FORGET - Remove a node from the nodes table.
     * GETKEYSINSLOT - Return local key names in the specified hash slot.
     * INFO - Provides info about Redis Cluster node state.
     * KEYSLOT - Returns the hash slot of the specified key.
     * MEET - Force a node cluster to handshake with another node.
     * NODES - Get cluster config for the node.
     * REPLICATE - Reconfigure a node as a slave of the specified master node.
     * RESET - Reset a Redis Cluster node.
     * SAVECONFIG - Forces the node to save cluster state on disk.
     * SET-CONFIG-EPOCH - Set the configuration epoch in a new node.
     * SETSLOT - Bind a hash slot to a specified node.
     * SLAVES - List slave nodes of the specified master node.
     * SLOTS - Get array of Cluster slot to node mappings.
     */
    clusterAsync: PromisedOverloadedCommand<string, any>;

    /**
     * Get array of Redis command details.
     *
     * COUNT - Get total number of Redis commands.
     * GETKEYS - Extract keys given a full Redis command.
     * INFO - Get array of specific REdis command details.
     */
    commandAsync(): Promise<Array<[string, number, string[], number, number, number]>>;

    /**
     * Get array of Redis command details.
     *
     * COUNT - Get array of Redis command details.
     * GETKEYS - Extract keys given a full Redis command.
     * INFO - Get array of specific Redis command details.
     * GET - Get the value of a configuration parameter.
     * REWRITE - Rewrite the configuration file with the in memory configuration.
     * SET - Set a configuration parameter to the given value.
     * RESETSTAT - Reset the stats returned by INFO.
     */
    configAsync: PromisedOverloadedCommand<string, boolean>;

    /**
     * Return the number of keys in the selected database.
     */
    dbsizeAsync(): Promise<number>;

    /**
     * OBJECT - Get debugging information about a key.
     * SEGFAULT - Make the server crash.
     */
    debugAsync: PromisedOverloadedCommand<string, boolean>;

    /**
     * Decrement the integer value of a key by one.
     */
    decrAsync(key: string): Promise<number>;

    /**
     * Decrement the integer value of a key by the given number.
     */
    decrbyAsync(key: string, decrement: number): Promise<number>;

    /**
     * Delete a key.
     */
    delAsync: PromisedOverloadedCommand<string, number>;

    /**
     * Discard all commands issued after MULTI.
     */
    discardAsync(): Promise<"OK">;

    /**
     * Return a serialized version of the value stored at the specified key.
     */
    dumpAsync(key: string): Promise<string>;

    /**
     * Echo the given string.
     */
    echoAsync<T extends string>(message: T): Promise<T>;

    /**
     * Execute a Lua script server side.
     */
    evalAsync: PromisedOverloadedCommand<string | number, any>;

    /**
     * Execute a Lue script server side.
     */
    evalshaAsync: PromisedOverloadedCommand<string | number, any>;

    /**
     * Determine if a key exists.
     */
    existsAsync: PromisedOverloadedCommand<string, number>;

    /**
     * Set a key's time to live in seconds.
     */
    expireAsync(key: string, seconds: number): Promise<number>;

    /**
     * Set the expiration for a key as a UNIX timestamp.
     */
    expireatAsync(key: string, timestamp: number): Promise<number>;

    /**
     * Remove all keys from all databases.
     */
    flushallAsync(): Promise<string>;

    /**
     * Remove all keys from the current database.
     */
    flushdbAsync(): Promise<string>;

    /**
     * Add one or more geospatial items in the geospatial index represented using a sorted set.
     */
    geoaddAsync: PromisedOverloadedKeyCommand<string | number, number>;

    /**
     * Returns members of a geospatial index as standard geohash strings.
     */
    geohashAsync: PromisedOverloadedKeyCommand<string, string>;

    /**
     * Returns longitude and latitude of members of a geospatial index.
     */
    geoposAsync: PromisedOverloadedKeyCommand<string, Array<[number, number]>>;

    /**
     * Returns the distance between two members of a geospatial index.
     */
    geodistAsync: PromisedOverloadedKeyCommand<string, string>;

    /**
     * Query a sorted set representing a geospatial index to fetch members matching a given maximum distance from a point.
     */
    georadiusAsync: PromisedOverloadedKeyCommand<string | number, Array<string | [string, string | [string, string]]>>;

    /**
     * Query a sorted set representing a geospatial index to fetch members matching a given maximum distance from a member.
     */
    georadiusbymemberAsync: PromisedOverloadedKeyCommand<string | number, Array<string | [string, string | [string, string]]>>;

    /**
     * Get the value of a key.
     */
    getAsync(key: string): Promise<string>;

    /**
     * Returns the bit value at offset in the string value stored at key.
     */
    getbitAsync(key: string, offset: number): Promise<number>;

    /**
     * Get a substring of the string stored at a key.
     */
    getrangeAsync(key: string, start: number, end: number): Promise<string>;

    /**
     * Set the string value of a key and return its old value.
     */
    getsetAsync(key: string, value: string): Promise<string>;

    /**
     * Delete on or more hash fields.
     */
    hdelAsync: PromisedOverloadedKeyCommand<string, number>;

    /**
     * Determine if a hash field exists.
     */
    hexistsAsync(key: string, field: string): Promise<number>;

    /**
     * Get the value of a hash field.
     */
    hgetAsync(key: string, field: string): Promise<string>;

    /**
     * Get all fields and values in a hash.
     */
    hgetallAsync(key: string): Promise<{ [key: string]: string }>;

    /**
     * Increment the integer value of a hash field by the given number.
     */
    hincrbyAsync(key: string, field: string, increment: number): Promise<number>;

    /**
     * Increment the float value of a hash field by the given amount.
     */
    hincrbyfloatAsync(key: string, field: string, increment: number): Promise<number>;

    /**
     * Get all the fields of a hash.
     */
    hkeysAsync(key: string): Promise<string[]>;

    /**
     * Get the number of fields in a hash.
     */
    hlenAsync(key: string): Promise<number>;

    /**
     * Get the values of all the given hash fields.
     */
    hmgetAsync: PromisedOverloadedKeyCommand<string, string[]>;

    /**
     * Set the string value of a hash field.
     */
    hsetAsync(key: string, field: string, value: string): Promise<number>;

    /**
     * Set the value of a hash field, only if the field does not exist.
     */
    hsetnxAsync(key: string, field: string, value: string): Promise<number>;

    /**
     * Get the length of the value of a hash field.
     */
    hstrlenAsync(key: string, field: string): Promise<number>;

    /**
     * Get all the values of a hash.
     */
    hvalsAsync(key: string): Promise<string[]>;

    /**
     * Increment the integer value of a key by one.
     */
    incrAsync(key: string): Promise<string[]>;

    /**
     * Increment the integer value of a key by the given amount.
     */
    incrbyAsync(key: string, increment: number): Promise<string[]>;

    /**
     * Increment the float value of a key by the given amount.
     */
    incrbyfloatAsync(key: string, increment: number): Promise<string[]>;

    /**
     * Find all keys matching the given pattern.
     */
    keysAsync(pattern: string): Promise<string[]>;

    /**
     * Get the UNIX time stamp of the last successful save to disk.
     */
    lastsaveAsync(): Promise<number>;

    /**
     * Get an element from a list by its index.
     */
    lindexAsync(key: string, index: number): Promise<string>;

    /**
     * Insert an element before or after another element in a list.
     */
    linsertAsync(key: string, dir: "BEFORE" | "AFTER", pivot: string, value: string): Promise<string>;

    /**
     * Get the length of a list.
     */
    llenAsync(key: string): Promise<number>;

    /**
     * Remove and get the first element in a list.
     */
    lpopAsync(key: string): Promise<string>;

    /**
     * Prepend one or multiple values to a list.
     */
    lpushAsync: PromisedOverloadedKeyCommand<string, number>;

    /**
     * Prepend a value to a list, only if the list exists.
     */
    lpushxAsync(key: string, value: string): Promise<number>;

    /**
     * Get a range of elements from a list.
     */
    lrangeAsync(key: string, start: number, stop: number): Promise<string[]>;

    /**
     * Remove elements from a list.
     */
    lremAsync(key: string, count: number, value: string): Promise<number>;

    /**
     * Set the value of an element in a list by its index.
     */
    lsetAsync(key: string, index: number, value: string): Promise<"OK">;

    /**
     * Trim a list to the specified range.
     */
    ltrimAsync(key: string, start: number, stop: number): Promise<"OK">;

    /**
     * Get the values of all given keys.
     */
    mgetAsync: PromisedOverloadedCommand<string, string[]>;

    /**
     * Atomically tranfer a key from a Redis instance to another one.
     */
    migrateAsync: PromisedOverloadedCommand<string, boolean>;

    /**
     * Move a key to another database.
     */
    moveAsync(key: string, db: string | number): void;

    /**
     * Set multiple keys to multiple values.
     */
    msetAsync: PromisedOverloadedCommand<string, boolean>;

    /**
     * Set multiple keys to multiple values, only if none of the keys exist.
     */
    msetnxAsync: PromisedOverloadedCommand<string, boolean>;

    /**
     * Inspect the internals of Redis objects.
     */
    objectAsync: PromisedOverloadedCommand<string, any>;

    /**
     * Remove the expiration from a key.
     */
    persistAsync(key: string): Promise<number>;

    /**
     * Remove a key's time to live in milliseconds.
     */
    pexpireAsync(key: string, milliseconds: number): Promise<number>;

    /**
     * Set the expiration for a key as a UNIX timestamp specified in milliseconds.
     */
    pexpireatAsync(key: string, millisecondsTimestamp: number): Promise<number>;

    /**
     * Adds the specified elements to the specified HyperLogLog.
     */
    pfaddAsync: PromisedOverloadedKeyCommand<string, number>;

    /**
     * Return the approximated cardinality of the set(s) observed by the HyperLogLog at key(s).
     */
    pfcountAsync: PromisedOverloadedCommand<string, number>;

    /**
     * Merge N different HyperLogLogs into a single one.
     */
    pfmergeAsync: PromisedOverloadedCommand<string, boolean>;

    /**
     * Set the value and expiration in milliseconds of a key.
     */
    psetexAsync(key: string, milliseconds: number, value: string): Promise<"OK">;

    /**
     * Inspect the state of the Pub/Sub subsytem.
     */
    pubsubAsync: PromisedOverloadedCommand<string, number>;

    /**
     * Get the time to live for a key in milliseconds.
     */
    pttlAsync(key: string): Promise<number>;

    /**
     * Close the connection.
     */
    quitAsync(): Promise<"OK">;

    /**
     * Return a random key from the keyspace.
     */
    randomkeyAsync(): Promise<string>;

    /**
     * Enables read queries for a connection to a cluster slave node.
     */
    readonlyAsync(): Promise<string>;

    /**
     * Disables read queries for a connection to cluster slave node.
     */
    readwriteAsync(): Promise<string>;

    /**
     * Rename a key.
     */
    renameAsync(key: string, newkey: string): Promise<"OK">;

    /**
     * Rename a key, only if the new key does not exist.
     */
    renamenxAsync(key: string, newkey: string): Promise<number>;

    /**
     * Create a key using the provided serialized value, previously obtained using DUMP.
     */
    restoreAsync(key: string, ttl: number, serializedValue: string): Promise<"OK">;

    /**
     * Return the role of the instance in the context of replication.
     */
    roleAsync(): Promise<[string, number, Array<[string, string, string]>]>;

    /**
     * Remove and get the last element in a list.
     */
    rpopAsync(key: string): Promise<string>;

    /**
     * Remove the last element in a list, prepend it to another list and return it.
     */
    rpoplpushAsync(source: string, destination: string): Promise<string>;

    /**
     * Append one or multiple values to a list.
     */
    rpushAsync: PromisedOverloadedKeyCommand<string, number>;

    /**
     * Append a value to a list, only if the list exists.
     */
    rpushxAsync(key: string, value: string): Promise<number>;

    /**
     * Append one or multiple members to a set.
     */
    saddAsync: PromisedOverloadedKeyCommand<string, number>;

    /**
     * Synchronously save the dataset to disk.
     */
    saveAsync(): Promise<string>;

    /**
     * Get the number of members in a set.
     */
    scardAsync(key: string): Promise<number>;

    /**
     * DEBUG - Set the debug mode for executed scripts.
     * EXISTS - Check existence of scripts in the script cache.
     * FLUSH - Remove all scripts from the script cache.
     * KILL - Kill the script currently in execution.
     * LOAD - Load the specified Lua script into the script cache.
     */
    scriptAsync: PromisedOverloadedCommand<string, any>;

    /**
     * Subtract multiple sets.
     */
    sdiffAsync: PromisedOverloadedCommand<string, string[]>;

    /**
     * Subtract multiple sets and store the resulting set in a key.
     */
    sdiffstoreAsync: PromisedOverloadedKeyCommand<string, number>;

    /**
     * Change the selected database for the current connection.
     */
    selectAsync(index: number | string): Promise<string>;

    /**
     * Set the string value of a key.
     */
    setAsync(key: string, value: string): Promise<"OK">;
    setAsync(key: string, value: string, flag: string): Promise<"OK">;
    setAsync(key: string, value: string, mode: string, duration: number): Promise<"OK" | undefined>;
    setAsync(key: string, value: string, mode: string, duration: number, flag: string): Promise<"OK" | undefined>;

    /**
     * Sets or clears the bit at offset in the string value stored at key.
     */
    setbitAsync(key: string, offset: number, value: string): Promise<number>;

    /**
     * Set the value and expiration of a key.
     */
    setexAsync(key: string, seconds: number, value: string): Promise<string>;

    /**
     * Set the value of a key, only if the key does not exist.
     */
    setnxAsync(key: string, value: string): Promise<number>;

    /**
     * Overwrite part of a string at key starting at the specified offset.
     */
    setrangeAsync(key: string, offset: number, value: string): Promise<number>;

    /**
     * Synchronously save the dataset to disk and then shut down the server.
     */
    shutdownAsync: PromisedOverloadedCommand<string, string>;

    /**
     * Intersect multiple sets.
     */
    sinterAsync: PromisedOverloadedKeyCommand<string, string[]>;

    /**
     * Intersect multiple sets and store the resulting set in a key.
     */
    sinterstoreAsync: PromisedOverloadedCommand<string, number>;

    /**
     * Determine if a given value is a member of a set.
     */
    sismemberAsync(key: string, member: string): Promise<number>;

    /**
     * Make the server a slave of another instance, or promote it as master.
     */
    slaveofAsync(host: string, port: string | number): Promise<string>;

    /**
     * Manages the Redis slow queries log.
     */
    slowlogAsync: PromisedOverloadedCommand<string, Array<[number, number, number, string[]]>>;

    /**
     * Get all the members in a set.
     */
    smembersAsync(key: string): Promise<string[]>;

    /**
     * Move a member from one set to another.
     */
    smoveAsync(source: string, destination: string, member: string): Promise<number>;

    /**
     * Sort the elements in a list, set or sorted set.
     */
    sortAsync: PromisedOverloadedCommand<string, string[]>;

    /**
     * Remove and return one or multiple random members from a set.
     */
    spopAsync(key: string): Promise<string>;
    spopAsync(key: string, count: number): Promise<string[]>;

    /**
     * Get one or multiple random members from a set.
     */
    srandmemberAsync(key: string): Promise<string>;
    srandmemberAsync(key: string, count: number): Promise<string[]>;

    /**
     * Remove one or more members from a set.
     */
    sremAsync: PromisedOverloadedKeyCommand<string, number>;

    /**
     * Get the length of the value stored in a key.
     */
    strlenAsync(key: string): Promise<number>;

    /**
     * Add multiple sets.
     */
    sunionAsync: PromisedOverloadedCommand<string, string[]>;

    /**
     * Add multiple sets and store the resulting set in a key.
     */
    sunionstoreAsync: PromisedOverloadedCommand<string, number>;

    /**
     * Internal command used for replication.
     */
    syncAsync(): Promise<void>;

    /**
     * Return the current server time.
     */
    timeAsync(): Promise<[string, string]>;

    /**
     * Get the time to live for a key.
     */
    ttlAsync(key: string): Promise<number>;

    /**
     * Determine the type stored at key.
     */
    typeAsync(key: string): Promise<string>;

    /**
     * Forget about all watched keys.
     */
    unwatchAsync(): Promise<"OK">;

    /**
     * Wait for the synchronous replication of all the write commands sent in the context of the current connection.
     */
    waitAsync(numslaves: number, timeout: number): Promise<number>;

    /**
     * Watch the given keys to determine execution of the MULTI/EXEC block.
     */
    watchAsync: PromisedOverloadedCommand<string, "OK">;

    /**
     * Add one or more members to a sorted set, or update its score if it already exists.
     */
    zaddAsync: PromisedOverloadedKeyCommand<string | number, number>;

    /**
     * Get the number of members in a sorted set.
     */
    zcardAsync(key: string): Promise<number>;

    /**
     * Count the members in a sorted set with scores between the given values.
     */
    zcountAsync(key: string, min: number | string, max: number | string): Promise<number>;

    /**
     * Increment the score of a member in a sorted set.
     */
    zincrbyAsync(key: string, increment: number, member: string): Promise<number>;

    /**
     * Intersect multiple sorted sets and store the resulting sorted set in a new key.
     */
    zinterstoreAsync: PromisedOverloadedCommand<string | number, number>;

    /**
     * Count the number of members in a sorted set between a given lexicographic range.
     */
    zlexcountAsync(key: string, min: string, max: string): Promise<number>;

    /**
     * Return a range of members in a sorted set, by index.
     */
    zrangeAsync(key: string, start: number, stop: number): Promise<string[]>;
    zrangeAsync(key: string, start: number, stop: number, withscores: string): Promise<string[]>;

    /**
     * Return a range of members in a sorted set, by lexicographical range.
     */
    zrangebylexAsync(key: string, min: string, max: string): Promise<string[]>;
    zrangebylexAsync(key: string, min: string, max: string, limit: string, offset: number, count: number): Promise<string[]>;

    /**
     * Return a range of members in a sorted set, by lexicographical range, ordered from higher to lower strings.
     */
    zrevrangebylexAsync(key: string, min: string, max: string): Promise<string[]>;
    zrevrangebylexAsync(key: string, min: string, max: string, limit: string, offset: number, count: number): Promise<string[]>;

    /**
     * Return a range of members in a sorted set, by score.
     */
    zrangebyscoreAsync(key: string, min: number | string, max: number | string): Promise<string[]>;
    zrangebyscoreAsync(key: string, min: number | string, max: number | string, withscores: string): Promise<string[]>;
    zrangebyscoreAsync(key: string, min: number | string, max: number | string, limit: string, offset: number, count: number): Promise<string[]>;
    zrangebyscoreAsync(key: string, min: number | string, max: number | string, withscores: string, limit: string, offset: number, count: number): Promise<string[]>;

    /**
     * Determine the index of a member in a sorted set.
     */
    zrankAsync(key: string, member: string): Promise<number | void>;

    /**
     * Remove one or more members from a sorted set.
     */
    zremAsync: PromisedOverloadedKeyCommand<string, number>;

    /**
     * Remove all members in a sorted set between the given lexicographical range.
     */
    zremrangebylexAsync(key: string, min: string, max: string): Promise<number>;

    /**
     * Remove all members in a sorted set within the given indexes.
     */
    zremrangebyrankAsync(key: string, start: number, stop: number): Promise<number>;

    /**
     * Remove all members in a sorted set within the given indexes.
     */
    zremrangebyscoreAsync(key: string, min: string | number, max: string | number): Promise<number>;

    /**
     * Return a range of members in a sorted set, by index, with scores ordered from high to low.
     */
    zrevrangeAsync(key: string, start: number, stop: number): Promise<string[]>;
    zrevrangeAsync(key: string, start: number, stop: number, withscores: string): Promise<string[]>;

    /**
     * Return a range of members in a sorted set, by score, with scores ordered from high to low.
     */
    zrevrangebyscoreAsync(key: string, min: number | string, max: number | string): Promise<string[]>;
    zrevrangebyscoreAsync(key: string, min: number | string, max: number | string, withscores: string): Promise<string[]>;
    zrevrangebyscoreAsync(key: string, min: number | string, max: number | string, limit: string, offset: number, count: number): Promise<string[]>;
    zrevrangebyscoreAsync(key: string, min: number | string, max: number | string, withscores: string, limit: string, offset: number, count: number): Promise<string[]>;

    /**
     * Determine the index of a member in a sorted set, with scores ordered from high to low.
     */
    zrevrankAsync(key: string, member: string): Promise<number | void>;

    /**
     * Get the score associated with the given member in a sorted set.
     */
    zscoreAsync(key: string, member: string): Promise<string>;

    /**
     * Add multiple sorted sets and store the resulting sorted set in a new key.
     */
    zunionstoreAsync: PromisedOverloadedCommand<string | number, number>;

    /**
     * Incrementally iterate the keys space.
     */
    scanAsync: PromisedOverloadedCommand<string, [string, string[]]>;

    /**
     * Incrementally iterate Set elements.
     */
    sscanAsync: PromisedOverloadedKeyCommand<string, [string, string[]]>;

    /**
     * Incrementally iterate hash fields and associated values.
     */
    hscanAsync: PromisedOverloadedKeyCommand<string, [string, string[]]>;

    /**
     * Incrementally iterate sorted sets elements and associated scores.
     */
    zscanAsync: PromisedOverloadedKeyCommand<string, [string, string[]]>;
}
// tslint:enable:member-ordering

declare module "redis" {
    interface RedisClient extends PromisedCommands { }
}

// Promisify redis stuff
const RedisPromised = promisifyAll(RedisClient.prototype);
Object.assign(RedisClient.prototype, RedisPromised);

export * from "redis";