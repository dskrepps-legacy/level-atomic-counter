# level-atomic-counter

[![npm](https://img.shields.io/npm/v/level-atomic-counter.svg)](https://www.npmjs.com/package/level-atomic-counter)

Accurately keep count of entries in a [levelup](https://github.com/level/levelup) store with [sublevel](https://www.npmjs.com/package/level-sublevel) installed. It does this by monkey-patching put/del/batch to check whether a key already exists or not before appending the new count to the batch of operations being written. The count is stored in a sublevel named 'counter'.

Note: The chained form a `batch()` is not supported.

```js
let level = require('level')
let sublevel = require('level-sublevel');
let db = sublevel( level('example.db') );

let Counter = require('level-atomic-counter');
Counter.install(db);

db.batch([
	{type: 'put', key: 1, value: 1},
	{type: 'put', key: 2, value: 2},
	{type: 'del', key: 1},
], (err) => {
	db.getCount((err, result) => {
		console.log(result); // 1
	});
});
```

### Methods

###### let counter = require('level-atomic-counter')(db);

This does not alter the db object and instead returns an object of methods in the form of {put, del, batch, getCount, recount} which will update the counter only when used.

###### require('level-atomic-counter').install(db);

This will install the methods onto the db object directly instead of returning them. Do it this way if you want all writes to the database to update the counter so long as those writes use this this particular db object.

###### counter.getCount(callback(Error, Number))

###### counter.recount(callback(Error, Number))


## License

MIT