var test = require('tape');
let level= require('level-test')();
let sublevel= require('level-sublevel');

var promisify = require('es6-promisify');
var after = require('after');

var levelAtomicCounter = require('../');


var db = sublevel(level('test.db', {errorIfExists: true}));
levelAtomicCounter.install(db);


var getCount = promisify(db.getCount);
var recount = promisify(db.recount);
var put = promisify(db.put);
var del = promisify(db.del);
var batch = promisify(db.batch);

// Convenience
function throwop(err) { console.log('sdgs'); if (err) throw err; }
function count() { return getCount(); }




test('getCount', function(t) {
	t.plan(3);
	
	getCount().then(function(result) {
		t.equal(result, 0, 'initially 0');
		
		return put('key', 'value');
	}).then(count).then(function(result) {
		t.equal(result, 1, 'results in 1 after first put()');
		
		return del('key');
	}).then(count).then(function(result) {
		t.equal(result, 0, 'results in 0 after following del()');
		
	}).catch(throwop);
});


test('put', function(t) {
	t.plan(3);
	
	put('key', 'value').then(count).then(function(result) {
		t.equal(result, 1, 'increments when adding new entry');
		
		return put('key', 'value2');
	}).then(count).then(function(result) {
		t.equal(result, 1, 'doesn\'t increment when updating entry');
		
		return put('key', 'value3', {counter: +2});
	}).then(count).then(function(result) {
		t.equal(result, 3, 'increments counter by opts.counter instead');
		
	}).catch(throwop);
});


test('recount', function(t) {
	t.plan(1);
	
	recount().then(function(result) {
		t.equal(result, 1, 'counts correctly');
		
	}).catch(throwop);
});


test('del', function(t) {
	t.plan(2);
	
	del('key').then(count).then(function(result) {
		t.equal(result, 0, 'decrements existing entry');
		
		return put('key', 'value');
	}).then(function(result) {
		
		return del('key2');
	}).then(count).then(function(result) {
		t.equal(result, 1, 'doesn\'t decrement when deleting non-existing entry');
		
	}).catch(throwop);
});


test('batch', function(t) {
	
	var ops = [
		{type: 'del', key: 'key'},
		{type: 'put', key: 1, value: 1},
		{type: 'put', key: 2, value: 2},
		{type: 'del', key: 3},
		{type: 'del', key: 4},
		{type: 'put', key: 5, value: 5},
		
		{type: 'del', key: 1},
		{type: 'put', key: 2, value: 22},
		{type: 'put', key: 3, value: 3},
	];
	
	
	t.plan(2);
	
	batch(ops).then(count).then(function(result) {
		t.equal(result, 3, 'works with multiple operations');
		
		return recount();
	}).then(function(result) {
		t.equal(result, 3, 'verified by recount');
		
	}).catch(throwop);
});


test('many operations', function(t) {
	
	t.plan(1);
	
	var next = after(750, function(err) {
		if (err) throw err;
		
		getCount().then(function(result1) {
			recount().then(function(result2) {
				t.equal(result1, result2, 'maintain atomicity');
				
			}).catch(throwop);
		}).catch(throwop);
	});
	
	for (var i = 0; i<500; i++) {
		db.put(i, i, next);
		if (i%2) db.del(i, next);
	}
	
	
});
