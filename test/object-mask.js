var expect = require('chai').expect;
var objtools = require('../lib');
var ObjectMask = objtools.ObjectMask;

describe('ObjectMask', function() {

	var obj1 = {
		str1: 'string',
		str2: 'string2',
		num1: 1,
		num2: 2,
		nul1: null,
		nul2: null,
		undef: undefined,
		obj: {
			foo: 'test',
			bar: 'test2',
			baz: 'test3'
		},
		arr: [
			{
				str1: 'one',
				str2: 'two'
			},
			{
				str1: 'three',
				str2: 'four'
			}
		]
	};

	var mask1 = {
		str1: true,
		str2: true,
		num1: true,
		nul1: true,
		nul2: true,
		obj: {
			foo: true,
			bar: true
		},
		arr: [
			{
				str1: true
			}
		]
	};

	var mask2 = {
		str1: true,
		num2: true,
		nul2: true,
		obj: {
			_: true,
			foo: false
		},
		arr: [
			{
				str2: true
			}
		]
	};

	describe('filterObject()', function() {

		it('basic functionality', function(done) {
			obj1 = objtools.deepCopy(obj1);
			var result;
			result = new ObjectMask({
				str1: true,
				num1: true,
				nul1: true,
				obj: {
					bar: true,
					nonexist: true
				}
			}).filterObject(obj1);
			expect(result).to.deep.equal({
				str1: 'string',
				num1: 1,
				nul1: null,
				obj: {
					bar: 'test2'
				}
			});
			done();
		});

		it('arrays and wildcards', function(done) {
			obj1 = objtools.deepCopy(obj1);
			var result;
			result = new ObjectMask({
				obj: {
					_: true,
					bar: false
				},
				arr: [
					{
						str2: true
					}
				]
			}).filterObject(obj1);
			expect(result).to.deep.equal({
				obj: {
					foo: 'test',
					baz: 'test3'
				},
				arr: [
					{
						str2: 'two'
					},
					{
						str2: 'four'
					}
				]
			});
			done();
		});

		it('getSubMask()', function(done) {
			expect(new ObjectMask({
				foo: {
					bar: {
						baz: true
					}
				}
			}).getSubMask('foo').toObject()).to.deep.equal({
				bar: {
					baz: true
				}
			});
			done();
		});

		it('checkPath()', function(done) {
			expect(new ObjectMask(mask1).checkPath('arr.8.str1')).to.be.true;
			expect(new ObjectMask(mask1).checkPath('arr.8.str2')).to.be.false;
			done();
		});

		it('addMasks()', function(done) {
			expect(ObjectMask.addMasks(new ObjectMask(mask1), new ObjectMask(mask2)).toObject()).to.deep.equal({
				str1: true,
				str2: true,
				num1: true,
				num2: true,
				nul1: true,
				nul2: true,
				obj: {
					_: true
				},
				arr: {
					_: {
						str1: true,
						str2: true
					}
				}
			});
			done();
		});

		it('andMasks()', function(done) {
			expect(ObjectMask.andMasks(new ObjectMask(mask1), new ObjectMask(mask2)).toObject()).to.deep.equal({
				str1: true,
				nul2: true,
				obj: {
					bar: true
				}
			});
			done();
		});

		it('validate()', function(done) {
			expect(new ObjectMask(mask1).validate()).to.be.true;
			expect(new ObjectMask(mask2).validate()).to.be.true;
			expect(new ObjectMask({
				foo: new Date()
			}).validate()).to.be.false;
			done();
		});

		it('getMaskedOutFields()', function(done) {
			expect(new ObjectMask(mask1).getMaskedOutFields(obj1).sort()).to.deep.equal([
				'num2',
				'undef',
				'obj.baz',
				'arr.0.str2',
				'arr.1.str2'
			].sort());
			done();
		});

		it('filterDottedObject()', function(done) {
			var dottedObj = objtools.collapseToDotted(obj1);
			var filtered = new ObjectMask(mask2).filterDottedObject(dottedObj);
			expect(filtered).to.deep.equal({
				str1: 'string',
				num2: 2,
				nul2: null,
				'obj.bar': 'test2',
				'obj.baz': 'test3',
				'arr.0.str2': 'two',
				'arr.1.str2': 'four'
			});
			done();
		});

		it('getDottedMaskedOutFields()', function(done) {
			var dottedObj = objtools.collapseToDotted(obj1);
			var fields = new ObjectMask(mask1).getDottedMaskedOutFields(dottedObj);
			expect(fields).to.deep.equal([
				'num2',
				'undef',
				'obj.baz',
				'arr.0.str2',
				'arr.1.str2'
			]);
			done();
		});

		it('checkFields()', function(done) {
			var mask = new ObjectMask(mask1);
			expect(mask.checkFields({ str1: 5 })).to.be.true;
			expect(mask.checkFields({ num2: 5 })).to.be.false;
			expect(mask.checkFields({ obj: { foo: 5 } })).to.be.true;
			expect(mask.checkFields({ obj: { baz: 5 } })).to.be.false;
			done();
		});

		it('checkDottedFields()', function(done) {
			var mask = new ObjectMask(mask1);
			expect(mask.checkDottedFields({ 'obj.foo': 5 })).to.be.true;
			expect(mask.checkDottedFields({ 'obj.baz': 5 })).to.be.false;
			done();
		});

		it('createMaskFromFieldList()', function(done) {
			var fields = [ 'foo', 'bar.baz', 'bar.baz.biz' ];
			expect(ObjectMask.createMaskFromFieldList(fields).toObject()).to.deep.equal({
				foo: true,
				bar: {
					baz: true
				}
			});
			done();
		});

		it('createFilterFunc()', function(done) {
			var func = new ObjectMask(mask1).createFilterFunc();
			expect(func(obj1)).to.deep.equal({
				str1: 'string',
				str2: 'string2',
				num1: 1,
				nul1: null,
				nul2: null,
				obj: {
					foo: 'test',
					bar: 'test2'
				},
				arr: [
					{
						str1: 'one'
					},
					{
						str1: 'three'
					}
				]
			});
			done();
		});

	});

});
