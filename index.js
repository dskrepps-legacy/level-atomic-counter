
'use strict';

let Lock = require('lock');
let after = require('after');
let exists = require('level-exists');

let throwop = err => { if (err) throw err; };


module.exports = counterFactory;
counterFactory.install = function install(db) {
	return Object.assign(db, counterFactory(db));
};


/** @param {Object} db - A levelUP-compatible store. */
function counterFactory(db) {
	if (!db || !db.put) throw new Error('levelUP-compatible store required');
	if (!db.sublevel) throw new Error('sublevel must be installed on db');
	
	let counter = db.sublevel('counter');
	let originalBatch = db.batch.bind(db);
	
	let lock = Lock().bind(null, 'counter');
	// Stub to double check the atomicity test fails without a lock:
	// let lock = cb=>cb(i=>i);
	
	let knownCount = null;
	
	return {
		put, del, batch,
		getCount, recount,
	};
	
	
	
	
	/** @param {Function(Error, Number)} [callback] */
	function getCount(cb=throwop) {
		
		if (Number.isInteger(knownCount)) {
			if (knownCount < 0) knownCount = 0;
			return setImmediate( ()=>cb(null, knownCount) );
		}
		
		// Lock to make sure we're not recounting
		lock(release => {
			cb = release(cb);
			
			counter.get('count', (err, result) => {
				if (err && err.notFound) result = 0;
				else if (err) return cb(err);
				
				cb(null, knownCount = Number(result));
			});
		});
	}
	
	
	/** @param {Function(Error, Number)} [callback] */
	function recount(cb=throwop) {
		
		let newCount = 0;
		
		// Lock to make ensure batch doesn't write an incorrect knownCount
		lock(release => {
			cb = release(cb);
			
			db.createKeyStream()
				.on('data', ()=>newCount++)
				.on('end', onDone)
				.on('error', cb);
		});
		
		function onDone() {
			counter.put('count', newCount, (err) => {
				cb(err, knownCount = newCount);
			});
		}
	}
	
	
	
	
	function put(key, value, opts, cb) {
		let op = {type: 'put', key, value};
		batch([op], opts, cb);
	}
	
	function del(key, opts, cb) {
		let op = {type: 'del', key};
		batch([op], opts, cb);
	}
	
	
	// Inject lock and exists calls into the callback chain if needed, updating
	// knownCount and appeanding a put to the batch to update the counter value
	function batch(ops, opts, cb=throwop) {
		if (typeof opts === 'function') {
			cb = opts;
			opts = undefined;
		}
		
		let delta = 0;
		
		// Skip the lock and exists calls if opts.counter is present
		if (opts && Number.isInteger(opts.counter)) {
			delta = opts.counter;
			return onExistsResults(null);
		}
		
		// Lock so that other writes don't occur between exists() and batch()
		lock(release => {
			cb = release(cb);
			
			// Only check the last occurance of each key
			let uniqOps = new Map();
			for (let op of ops) uniqOps.set(op.key, op);
			
			// run onExistsResults after next has been called .size times
			let next = after(uniqOps.size, onExistsResults);
			
			for (let op of uniqOps.values()) {
				exists(db, op.key, (err, found) => {
					if (err) return cb(err);
					if (!found && op.type === 'put') delta++;
					if (found && op.type === 'del') delta--;
					next(err);
				});
			}
		});
		
		function onExistsResults(err) {
			if (err) return cb(err);
			
			ops.push({ type: 'put', prefix: counter,
				key: 'count', value: knownCount+delta });
			
			originalBatch(ops, opts, updateCount);
		}
		
		function updateCount(err) {
			if (!err) knownCount += delta;
			cb(err);
		}
	}
	
}
