var expect = require('chai').expect;
var objtools = require('../lib');

describe('Base Functions', function() {

	describe('isScalar()', function() {

		it('should return true for scalar values', function(done) {
			expect(objtools.isScalar(true)).to.be.true;
			expect(objtools.isScalar(false)).to.be.true;
			expect(objtools.isScalar(new Date())).to.be.true;
			expect(objtools.isScalar(123)).to.be.true;
			expect(objtools.isScalar(null)).to.be.true;
			expect(objtools.isScalar(undefined)).to.be.true;
			expect(objtools.isScalar(function() {})).to.be.true;
			done();
		});

		it('should return false for non-scalar values', function(done) {
			expect(objtools.isScalar({})).to.be.false;
			expect(objtools.isScalar([])).to.be.false;
			expect(objtools.isScalar(new Error())).to.be.false;
			done();
		});

	});

	describe('scalarEquals', function() {

		var date1 = new Date('2014-01-01T00:00:00Z');
		var date2 = new Date('2014-01-01T00:00:00Z');
		var date3 = new Date('2014-01-01T00:00:01Z');

		it('should handle dates', function(done) {
			expect(objtools.scalarEquals(date1, date2)).to.be.true;
			expect(objtools.scalarEquals(date2, date3)).to.be.false;
			done();
		});

		it('should handle other types', function(done) {
			var func = function() {};
			var obj = {};
			expect(objtools.scalarEquals(2, 2)).to.be.true;
			expect(objtools.scalarEquals(true, true)).to.be.true;
			expect(objtools.scalarEquals(null, null)).to.be.true;
			expect(objtools.scalarEquals(undefined, undefined)).to.be.true;
			expect(objtools.scalarEquals(0, null)).to.be.false;
			expect(objtools.scalarEquals(obj, obj)).to.be.true;
			expect(objtools.scalarEquals(func, func)).to.be.true;
			expect(objtools.scalarEquals(obj, func)).to.be.false;
			expect(objtools.scalarEquals({}, {})).to.be.false;
			done();
		});

	});

	describe('deepEquals()', function() {

		var date1 = new Date('2014-01-01T00:00:00Z');
		var date2 = new Date('2014-01-01T00:00:00Z');
		var date3 = new Date('2014-01-01T00:00:01Z');

		var obj1 = {
			foo: {
				bar: "baz",
				biz: [1, 2]
			}
		};
		var obj2 = {
			foo: {
				bar: "baz",
				biz: [1, 2]
			}
		};
		var obj3 = {
			foo: {
				bar: "biz"
			},
			biz: [1, 2]
		};
		var obj4 = {
			foo: {
				bar: "biz"
			},
			biz: [1]
		};

		it('should handle dates correctly', function(done) {
			expect(objtools.deepEquals(date1, date2)).to.be.true;
			expect(objtools.deepEquals(date2, date3)).to.be.false;
			expect(objtools.deepEquals({ d: date1 }, { d: date2 })).to.be.true;
			done();
		});

		it('should handle objects correctly', function(done) {
			expect(objtools.deepEquals(obj1, obj2)).to.be.true;
			expect(objtools.deepEquals(obj2, obj3)).to.be.false;
			expect(objtools.deepEquals(obj3, obj4)).to.be.false;
			done();
		});

		it('should not coerce types', function(done) {
			expect(objtools.deepEquals({a: null}, {a: null})).to.be.true;
			expect(objtools.deepEquals({a: undefined}, {a: undefined})).to.be.true;
			expect(objtools.deepEquals({a: null}, {a: undefined})).to.be.false;
			expect(objtools.deepEquals({a: 0}, {a: null})).to.be.false;
			done();
		});

	});

	describe('deepCopy()', function() {

		var obj1 = {
			foo: 'bar',
			fuzz: 123,
			biz: {
				dat: new Date('2014-01-01T00:00:00Z'),
				n: null,
				u: undefined
			},
			arr: [1, 2]
		};

		it('should correctly copy objects', function(done) {
			var copy = objtools.deepCopy(obj1);
			expect(copy).to.deep.equal(obj1);
			expect(null).to.not.deep.equal(undefined);	// make sure chai does what we want it to
			done();
		});

		it('should not maintain references to objects', function(done) {
			var copy = objtools.deepCopy(obj1);
			expect(copy).to.deep.equal(obj1);
			copy.biz.dat = 123;
			expect(copy).to.not.deep.equal(obj1);
			done();
		});

	});

	describe('collapseToDotted()', function() {

		var obj1 = {
			foo: 123,
			bar: {
				biz: 12,
				baz: {
					buz: 1
				}
			},
			arr: [1, 2, {
				foo: 3
			}]
		};

		it('should correctly collapse objects to dotted form', function(done) {
			var dotted = objtools.collapseToDotted(obj1);
			expect(dotted).to.deep.equal({
				foo: 123,
				'bar.biz': 12,
				'bar.baz.buz': 1,
				'arr.0': 1,
				'arr.1': 2,
				'arr.2.foo': 3
			});
			done();
		});

		it('should obey includeRedundantLevels', function(done) {
			var dotted = objtools.collapseToDotted(obj1, true);
			expect(dotted).to.deep.equal({
				foo: 123,
				bar: obj1.bar,
				'bar.biz': 12,
				'bar.baz': obj1.bar.baz,
				'bar.baz.buz': 1,
				'arr': obj1.arr,
				'arr.0': 1,
				'arr.1': 2,
				'arr.2.foo': 3,
				'arr.2': obj1.arr[2]
			});
			// check for referential equality
			expect(dotted.bar).to.equal(obj1.bar);
			expect(dotted.bar.baz).to.equal(obj1.bar.baz);
			done();
		});

		it('should obey stopAtArrays', function(done) {
			var dotted = objtools.collapseToDotted(obj1, false, true);
			expect(dotted).to.deep.equal({
				foo: 123,
				'bar.biz': 12,
				'bar.baz.buz': 1,
				'arr': obj1.arr
			});
			expect(dotted.arr).to.equal(obj1.arr);
			done();
		});

	});

	describe('match functions', function() {

		it('matchObject()', function(done) {
			expect(objtools.matchObject({
				foo: 'foo',
				bar: {
					biz: 12
				},
				zip: [4, 5]
			}, {
				foo: 'foo',
				'bar.biz': 12,
				'zip.1': 5
			})).to.be.true;
			expect(objtools.matchObject({
				foo: 'foo',
				bar: {
					biz: 12
				},
				zip: [4, 5]
			}, {
				foo: 'foo',
				'bar.biz': 12,
				'zip.2': 5
			})).to.be.false;
			done();
		});

		it('matchDottedObject()', function(done) {
			expect(objtools.matchDottedObject({
				foo: 'foo',
				bar: {
					biz: 12
				},
				zip: [4, 5]
			}, {
				foo: 'foo',
				'bar': {
					biz: 12
				},
				'zip': [4, 5]
			})).to.be.true;
			expect(objtools.matchDottedObject({
				foo: 'foo',
				bar: {
					biz: 12
				},
				zip: [4, 5]
			}, {
				foo: 'foo',
				'bar': {
					biz: 12
				},
				'zip': [4, 2]
			})).to.be.false;
			done();
		});

	});

	describe('path functions', function() {

		var obj1 = {
			foo: 'bar',
			baz: {
				biz: 'buz',
				arr: [
					1,
					2,
					{
						zip: 3
					}
				],
				arr2: [
					{
						zip: 4
					}
				]
			}
		};

		var getPath = objtools.getPath;
		var deletePath = objtools.deletePath;
		var setPath = objtools.setPath;

		it('getPath should fetch basic object paths', function(done) {
			expect(getPath(obj1, 'foo')).equals(obj1.foo);
			expect(getPath(obj1, 'baz')).equals(obj1.baz);
			expect(getPath(obj1, 'baz.biz')).equals(obj1.baz.biz);
			expect(getPath(obj1, 'baz.arr2.zip')).equals(undefined);
			expect(getPath(obj1, 'baz.arr.1')).equals(2);
			expect(getPath(obj1, 'baz.arr.2.zip')).equals(3);
			done();
		});

		it('getPath should obey allowSkipArrays', function(done) {
			expect(getPath(obj1, 'foo', true)).equals(obj1.foo);
			expect(getPath(obj1, 'baz', true)).equals(obj1.baz);
			expect(getPath(obj1, 'baz.biz', true)).equals(obj1.baz.biz);
			expect(getPath(obj1, 'baz.arr2.zip', true)).equals(4);
			expect(getPath(obj1, 'baz.arr.1', true)).equals(2);
			expect(getPath(obj1, 'baz.arr.2.zip', true)).equals(3);
			done();
		});

		it('setPath should set various paths', function(done) {
			setPath(obj1, 'foo', 'biz');
			expect(obj1.foo).to.equal('biz');
			setPath(obj1, 'baz.arr.1', 8);
			expect(obj1.baz.arr[1]).to.equal(8);
			done();
		});

		it('setPath should create parent objects as necessary', function(done) {
			setPath(obj1, 'bar.biz.baz.buz', 10);
			expect(obj1.bar).to.deep.equal({biz:{baz:{buz: 10}}});
			done();
		});

		it('setPath should overwrite parent object on conflicting type', function(done) {
			setPath(obj1, 'baz.arr.1.buz', 11);
			expect(obj1.baz.arr[1]).to.deep.equal({ buz: 11 });
			done();
		});

		it('deletePath should delete paths', function(done) {
			deletePath(obj1, 'baz.arr');
			expect(obj1.baz.arr).to.equal(undefined);
			done();
		});

	});

});


