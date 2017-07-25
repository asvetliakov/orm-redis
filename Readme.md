# Redis ORM for TypeScript

## Features:

* Modern ORM based on decorators & datamapper pattern
* Type binding for numbers, booleans, strings, dates. Objects/arrays are being converted to json strings
* Native support for ES2015 Maps and Sets (Stored as separated hashes/sets in Redis)
* Single field relation support
* Multiple relations support for Maps and Sets
* Relations cascade inserting/updating (But not deleting)
* Entity subscriber support & built-in pubsub subscriber
* Operation optimized - writes to redis only changed values
* Lazy maps/sets support
* Optimistic locking (WIP)

## Requirments

* TypeScript 2.3 or greater
* Node 7.*
* Symbol.asyncIterator polyfill to iterate over lazy maps/sets

## Setup

Enable ```emitDecoratorMetadata``` and ```experimentalDecorators``` in your tsconfig.json

Install ```reflect-metadata``` library and import it somewhere in your project:

```
npm install reflect-metadata --save

// in index.ts
import "reflect-metadata";
```

If you're going to use lazy maps/sets then you need ```Symbol.asyncIterator``` polyfill. This can be easily achived by writing this somewhere in app:
```ts
(Symbol as any).asyncIterator = (Symbol as any).asyncIterator || Symbol.for("Symbol.asyncIterator");
```

## Examples

### Basic example

```ts
    import { createConnection, Entity, Property, IdentifyProperty } from "orm-redis";

    @Entity()
    class MyEntity {
        // You must have one identify property. Supported only string and numbers
        @IdentifyProperty()
        public id: number;

        @Property()
        public myString: string;

        @Property()
        public myNumber: number;

        @Property()
        public myDate: Date;

        @Property()
        public myObj: object; // will be stored in json

        @Property(Set)
        public mySet: Set<any> = new Set(); // uses redis sets

        @Property(Map)
        public myMap: Map<any, any> = new Map(); // uses redis maps
    }

    createConnection({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
    }).then(async connection => {
        const entity = new MyEntity();
        entity.id = 1;
        entity.myString = "abc";
        entity.myNumber = 1;
        entity.myDate = new Date();
        // 1 and "1" keys are different for sets and maps
        entity.mySet.add(1).add("1");
        entity.myMap.set(1, true).set("1", false);

        await connection.manager.save(entity);

        // Load entity
        const stored = await connection.manager.load(MyEntity, 1):
        stored.id; // 1
        stored.myDate; // Date object
        stored.myMap; // Map { 1: true, "1": false }
        stored.mySet; // Set [ 1, "1" ]

        stored.myMap.delete(1);
        stored.myMap.set(3, "test");
        stored.myNumber = 10;

        // Save changes. Will trigger persistence operation only for changed keys
        await connection.manager.save(stored);

        // Delete
        await connection.manager.delete(stored);
    }).catch(console.error);
```

### Relations

ORM supports both single relations (linked to a single property) and multiple relations (linked to Set/Map)

```ts

    @Entity()
    class Relation {
        @IdentifyProperty()
        public id: number;

        @Property()    
        public relProp: string;
    }

    @Entity()
    class Owner {
        @IdentifyProperty()
        public id: string;

        @RelationProperty(type => Relation, { cascadeInsert: true, cascadeUpdate: true })
        public rel: Relation;

        @RelationProperty(type => [Relation, Set], { cascadeInsert: true })
        public relationSet: Set<Relation> = new Set();

        @RelationProperty(type => [Relation, Map], { cascadeInsert: true })
        public relationMap: Map<number, Relation> = new Map();
    }

    const rel1 = new Relation();
    rel1.id = 1;
    const rel2 = new Relation();
    rel2.id = 2;
    const owner = new Owner();
    owner.id = "test";
    owner.rel = rel1;
    owner.relationSet.add(rel1);
    owner.relationMap.set(10, rel1);
    owner.relationMap.set(12, rel2);

    // Cascading insert will save all relations too in object
    await manager.save(owner);

    // Get and eager load all relations, including all inner relations (if presented)
    const loaded = await manager.load(Owner, "test");
    loaded.rel.relProp = "test";
    // If cascadeUpdate was set then will trigger update operation for Relation entity
    await manager.save(loaded);

    // Don't load relations for properties rel and relationMap
    const another = await manager.load(Owner, "test", /* skip relations */ ["rel", "relationMap"]);
```

*NOTE: ORM DOESN'T support cascade delete operation now, you must delete your relations manually*

```ts
    @Entity()
    class Relation {
        @IdentifyProperty()
        public id: number;
    }

    @Entity()
    class Owner {
        @IdentifyProperty()
        public id: number;

        @RelationProperty(type => [Relation, Set])
        public setRel: Set<Relation> = new Set();
    }

    // To clean owner object with all linked relations:
    const owner = await manager.load(Owner, 1);
    for (const rel of owner.setRel) {
        await manager.delete(rel);
    }
    await manager.delete(owner);
```

### Lazy collections

By default all sets/maps are being loaded eagerly. If your map/set in redis is very big, it can take some time to load, especially for relation sets/maps.
You can use lazy sets/maps in this case:

```ts
    import { LazySet, LazyMap } from "orm-redis";

    @Entity()
    class Ent {
        @IdentifyProperty()
        public id: number;

        @Property()    
        public set: LazySet<any> = new LazySet();

        @Property()
        public map: LazyMap<any, any> = new LazyMap()
    }

    const ent = new Ent();
    ent.id = 1;
    // Won't be saved until calling manager.save() for new entities
    await ent.set.add(1);
    await ent.map.set(1, true);

    await manager.save(ent);

    // Immediately saved to set in redis now
    await ent.set.add(2);

    // Use asyncronyous iterator available in TS 2.3+
    for await (const v of ent.set) {
        // do something with v
    }
    console.log(await ent.set.size()); // 2

    const anotherEnt = await manager.load(Ent, 2);
    for await (const [key, val] of anotherEnt.map) {
        // [1, true]
    }

    @Entity()
    class Rel {
        @IdentifyProperty()
        public id: number;
    }

    @Entity()
    class AnotherEnt {
        @IdentifyProperty()
        public id: number;

        @RelationProperty(type => [Rel, LazyMap], { cascadeInsert: true }) // same rules as for ordinary relation map/set for cascading ops
        public map: LazyMap<number, Rel> = new LazyMap()
    }

    const rel = new Rel();
    rel.id = 1;
    const anotherEnt = new AnotherEnt();
    anotherEnt.id = 1;
    anotherEnt.map.set(1, rel);

    await manager.save(anotherEnt);

    const savedEnt = await manager.load(AnotherEnt, 1);
    await savedEnt.map.get(1); // Rel { id: 1 }
```

Asyncronyous iterators are using ```SCAN``` redis command so they suitable for iterating over big collections.

LazyMap/LazySet after saving entity/loading entity are being converted to specialized RedisLazyMap/RedisLazySet.

Also it's possible to use RedisLazyMap/RedisLazySet directly:

```ts
    const map = new RedisLazyMap(/* redis map id */"someMapId", /* redis manager */ connection.manager);
    await map.set(1, true);
    await map.set(2, false);

    for await (const [key, val] of map) {
        // [1, true], [2, false]
    }

```

### Subscribers


### PubSub


### Connection