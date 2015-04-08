let { expect } = require('chai');
let XError = require('xerror');
let _ = require('lodash');

let objtools = require('../lib');
let ObjectMask = objtools.ObjectMask;

describe('ObjectMask', function() {

	let obj1 = {
		str1: 'string',
		str2: 'string2',
		num1: 1,
		num2: 2,
		nul1: null,
		nul2: null,
		undef: undefined,
		obj: { foo: 'test', bar: 'test2', baz: 'test3' },
		arr: [
			{ str1: 'one', str2: 'two' },
			{ str1: 'three', str2: 'four' }
		]
	};

	let mask1 = {
		str1: true,
		str2: true,
		num1: true,
		nul1: true,
		nul2: true,
		obj: { foo: true, bar: true },
		arr: [ { str1: true } ]
	};

	let mask2 = {
		str1: true,
		num2: true,
		nul2: true,
		obj: { _: true, foo: false },
		arr: [ { str2: true } ]
	};

	describe('new ObjectMask()', function() {
		it('underscorizes wildcard arrays', function() {
			let orig = new ObjectMask({ foo: [ { baz: true } ] });
			let expectedMask = { foo: { _: { baz: true } } };
			expect(orig.mask).to.deep.equal(expectedMask);
		});
	});

	describe('addMasks()', function() {
		it('adds masks', function() {
			expect(ObjectMask.addMasks(new ObjectMask(mask1), new ObjectMask(mask2)).toObject()).to.deep.equal({
				str1: true,
				str2: true,
				num1: true,
				num2: true,
				nul1: true,
				nul2: true,
				obj: { _: true },
				arr: { _: { str1: true, str2: true } }
			});
		});
	});

	describe('andMasks()', function() {
		it('makes a mask that matches all fields that either mask matches', function() {
			const result = ObjectMask.andMasks(new ObjectMask(mask1), new ObjectMask(mask2)).toObject();
			const expected = {
				str1: true,
				nul2: true,
				obj: { bar: true }
			};
			expect(result).to.deep.equal(expected);
		});
	});

	describe('#filterObject()', function() {
		it('gets the fields in an object the mask matches', function() {
			obj1 = objtools.deepCopy(obj1);
			const result = new ObjectMask({
				str1: true,
				num1: true,
				nul1: true,
				obj: { bar: true, nonexist: true }
			}).filterObject(obj1);
			expect(result).to.deep.equal({
				str1: 'string',
				num1: 1,
				nul1: null,
				obj: { bar: 'test2' }
			});
		});

		it('handles arrays and wildcards', function() {
			obj1 = objtools.deepCopy(obj1);
			const result = new ObjectMask({
				obj: { _: true, bar: false },
				arr: [ { str2: true } ]
			}).filterObject(obj1);
			expect(result).to.deep.equal({
				obj: { foo: 'test', baz: 'test3' },
				arr: [ { str2: 'two' }, { str2: 'four' } ]
			});
		});
	});

	describe('#getSubMask()', function() {
		it('gets a submask', function() {
			expect(new ObjectMask({
				foo: { bar: { baz: true } }
			}).getSubMask('foo').toObject()).to.deep.equal({
				bar: { baz: true }
			});
		});
	});

	describe('#checkPath()', function() {
		it('checks if the mask matches the path', function() {
			expect(new ObjectMask(mask1).checkPath('arr.8.str1')).to.be.true;
			expect(new ObjectMask(mask1).checkPath('arr.8.str2')).to.be.false;
		});
	});

	describe('#validate()', function() {
		expect(new ObjectMask(mask1).validate()).to.be.true;
		expect(new ObjectMask(mask2).validate()).to.be.true;
		expect(new ObjectMask({ foo: new Date() }).validate()).to.be.false;
	});

	describe('#getMaskedOutFields()', function() {
		expect(new ObjectMask(mask1).getMaskedOutFields(obj1).sort()).to.deep.equal([
			'num2',
			'undef',
			'obj.baz',
			'arr.0.str2',
			'arr.1.str2'
		].sort());
	});

	describe('#filterDottedObject()', function() {
		let dottedObj = objtools.collapseToDotted(obj1);
		let filtered = new ObjectMask(mask2).filterDottedObject(dottedObj);
		expect(filtered).to.deep.equal({
			str1: 'string',
			num2: 2,
			nul2: null,
			'obj.bar': 'test2',
			'obj.baz': 'test3',
			'arr.0.str2': 'two',
			'arr.1.str2': 'four'
		});
	});

	describe('#getDottedMaskedOutFields()', function() {
		let dottedObj = objtools.collapseToDotted(obj1);
		let fields = new ObjectMask(mask1).getDottedMaskedOutFields(dottedObj);
		expect(fields).to.deep.equal([
			'num2',
			'undef',
			'obj.baz',
			'arr.0.str2',
			'arr.1.str2'
		]);
	});

	describe('#checkFields()', function() {
		let mask = new ObjectMask(mask1);
		expect(mask.checkFields({ str1: 5 })).to.be.true;
		expect(mask.checkFields({ num2: 5 })).to.be.false;
		expect(mask.checkFields({ obj: { foo: 5 } })).to.be.true;
		expect(mask.checkFields({ obj: { baz: 5 } })).to.be.false;
	});

	describe('#checkDottedFields()', function() {
		let mask = new ObjectMask(mask1);
		expect(mask.checkDottedFields({ 'obj.foo': 5 })).to.be.true;
		expect(mask.checkDottedFields({ 'obj.baz': 5 })).to.be.false;
	});

	describe('#createMaskFromFieldList()', function() {
		let fields = [ 'foo', 'bar.baz', 'bar.baz.biz' ];
		expect(ObjectMask.createMaskFromFieldList(fields).toObject()).to.deep.equal({
			foo: true,
			bar: { baz: true }
		});
	});

	describe('#createFilterFunc()', function() {
		let func = new ObjectMask(mask1).createFilterFunc();
		expect(func(obj1)).to.deep.equal({
			str1: 'string',
			str2: 'string2',
			num1: 1,
			nul1: null,
			nul2: null,
			obj: { foo: 'test', bar: 'test2' },
			arr: [ { str1: 'one' }, { str1: 'three' } ]
		});
	});

	describe('#addField()', function() {
		it('does not affect masks that already match', function() {
			let orig = new ObjectMask({ foo: true });
			let expected = _.cloneDeep(orig);
			expect(orig.addField('foo.bar')).to.deep.equal(expected);
		});

		it('recurses to subfields', function() {
			let orig = new ObjectMask({ foo: false, baz: true });
			let expected = new ObjectMask({ foo: { bar: true }, baz: true });
			expect(orig.addField('foo.bar')).to.deep.equal(expected);
		});

		it('prunes to become more general', function() {
			let orig = new ObjectMask({ foo: { bar: true } });
			let expected = new ObjectMask({ foo: true });
			expect(orig.addField('foo')).to.deep.equal(expected);
		});

		it('does not become more restrictive', function() {
			let orig = new ObjectMask({ _: true });
			let shouldPass = { foo: { baz: 1 } };
			expect(orig.checkFields(shouldPass)).to.be.true;
			expect(orig.addField('foo.bar').checkFields(shouldPass)).to.be.true;
		});
	});

	describe('#removeField()', function() {
		const shouldPass = { foo: { bar: { foobar: true } } };
		const shouldAlsoPass = { foo: { biz: { baz: true } } };
		const shouldFail = { foo: { bar: { baz: true } } };
		const expected = new ObjectMask({ foo: {
			bar: { baz: false, foobar: true },
			_: { baz: true, foobar: true } }
		});

		it('branches wildcards', function() {
			let orig = new ObjectMask({ foo: { _: { baz: true, foobar: true } } });
			expect(orig.removeField('foo.bar.baz').checkFields(shouldPass), 'post: shouldPass').to.be.true;
			expect(orig.removeField('foo.bar.baz').checkFields(shouldAlsoPass), 'post: shouldAlsoPass').to.be.true;
			expect(orig.removeField('foo.bar.baz').checkFields(shouldFail), 'post: shouldFail').to.be.false;
			expect(orig.removeField('foo.bar.baz')).to.deep.equal(expected);
		});

		it('doesnt remove other fields', function() {
			let orig = new ObjectMask({ foo: { _: { baz: true, foobar: true } } });
			expect(orig.checkFields(shouldPass), 'pre: shouldPass').to.be.true;
			expect(orig.checkFields(shouldAlsoPass), 'pre: shouldAlsoPass').to.be.true;
			expect(orig.checkFields(shouldFail), 'pre: shouldFail').to.be.true;
			expect(orig.removeField('foo.bar.baz').checkFields(shouldPass), 'post: shouldPass').to.be.true;
			expect(orig.removeField('foo.bar.baz').checkFields(shouldAlsoPass), 'post: shouldAlsoPass').to.be.true;
			expect(orig.removeField('foo.bar.baz').checkFields(shouldFail), 'post: shouldFail').to.be.false;
		});

		it('doesnt match new fields', function() {
			let orig = new ObjectMask({ _: { bar: { baz: true } } });
			let shouldFail = { foo: { bar: { foobar: true } } };
			expect(orig.checkFields(shouldFail)).to.be.false;
			expect(orig.removeField('foo.bar.baz').checkFields(shouldFail)).to.be.false;
		});

		it('throws on attempt to remove wildcard', function() {
			let orig = new ObjectMask({ _: [ true ] });
			expect(() => orig.removeField('_')).to.throw();
			expect(() => orig.removeField('foo._')).to.throw(XError);
		});
	});
});
