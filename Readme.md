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