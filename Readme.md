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
* Optimistic locking (WIP)
* Lazy properties/maps/sets support (WIP)

## Requirments

* TypeScript 2.3 or greater
* Node 7.*

## Setup

Enable ```emitDecoratorMetadata``` and ```experimentalDecorators``` in your tsconfig.json

Install ```reflect-metadata``` library and import it somewhere in your project:

```
npm install reflect-metadata --save

// in index.ts
import "reflect-metadata";
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


### Subscribers


### PubSub


### Connection