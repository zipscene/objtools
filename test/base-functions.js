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
				bar: "baz"
			}
		};
		var obj2 = {
			foo: {
				bar: "baz"
			}
		};
		var obj3 = {
			foo: {
				bar: "biz"
			}
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
			}
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

});


