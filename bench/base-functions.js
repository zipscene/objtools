let { benchset, compare, bench } = require('spectrophotometer');
let objtools = require('../lib');
let _ = require('lodash');

benchset('#merge', function() {
	compare('small objects', function() {
		const obj1 = { foo: 1, bar: { zip: 3 } };
		const obj2 = { foo: 3, zip: 4, bar: { bam: 4 } };

		bench('objtools.merge', function() {
			objtools.merge({}, obj1, obj2);
		});

		bench('lodash.merge', function() {
			_.merge({}, obj1, obj2);
		});
	});

	compare('medium objects', function() {
		const obj1 = { a: {
			b: [ 'c' ],
			d: 'e',
			f: { g: 'h' },
			i: 'jk',
			l: [ 'o', 'l' ]
		} };

		const obj2 = { a: {
			b: 'c',
			d: [ 'e' ],
			f: 'gh',
			i: { j: 'k' },
			l: { o: 'l' }
		} };

		bench('objtools.merge', function() {
			objtools.merge({}, obj1, obj2);
		});

		bench('lodash.merge', function() {
			_.merge({}, obj1, obj2);
		});
	});
});

benchset('#deepEquals', function() {
	compare('small objects', function() {
		const obj1 = { foo: 1, bar: { zip: 3 } };
		const obj2 = { foo: 3, zip: 4, bar: { bam: 4 } };

		bench('objtools.deepEquals', function() {
			objtools.deepEquals(obj1, obj2);
		});

		bench('lodash.isEqual', function() {
			_.isEqual(obj1, obj2);
		});
	});

	compare('medium objects', function() {
		const obj1 = { a: {
			b: [ 'c' ],
			d: 'e',
			f: { g: 'h' },
			i: 'jk',
			l: [ 'o', 'l' ]
		} };

		const obj2 = { a: {
			b: 'c',
			d: [ 'e' ],
			f: 'gh',
			i: { j: 'k' },
			l: { o: 'l' }
		} };

		bench('objtools.deepEquals', function() {
			objtools.deepEquals(obj1, obj2);
		});

		bench('lodash.isEqual', function() {
			_.isEqual(obj1, obj2);
		});
	});
});

benchset('#deepCopy', function() {
	compare('small objects', function() {
		const obj1 = { foo: 1, bar: { zip: 3 } };

		bench('objtools.deepCopy', function() {
			objtools.deepCopy(obj1);
		});

		bench('lodash.cloneDeep', function() {
			_.cloneDeep(obj1);
		});
	});

	compare('medium objects', function() {
		const obj1 = { a: {
			b: [ 'c' ],
			d: 'e',
			f: { g: 'h' },
			i: 'jk',
			l: [ 'o', 'l' ]
		} };

		bench('objtools.deepCopy', function() {
			objtools.deepCopy(obj1);
		});

		bench('lodash.cloneDeep', function() {
			_.cloneDeep(obj1);
		});
	});
});

benchset('#matchObject', function() {
	const smallObj1 = { foo: 1, bar: { zip: 3 } };
	const smallObj2 = { foo: 3, zip: 4, bar: { bam: 4 } };
	const mediumObj1 = { a: {
		b: [ 'c' ],
		d: 'e',
		f: { g: 'h' },
		i: 'jk',
		l: [ 'o', 'l' ]
	} };
	const mediumObj2 = { a: {
		b: 'c',
		d: [ 'e' ],
		f: 'gh',
		i: { j: 'k' },
		l: { o: 'l' }
	} };

	compare('small objects, match', function() {
		bench('objtools.matchObject', function() {
			objtools.matchObject(smallObj1, smallObj1);
		});
		bench('lodash.isMatch', function() {
			_.isMatch(smallObj1, smallObj1);
		});
	});

	compare('small objects, no match', function() {
		bench('objtools.matchObject', function() {
			objtools.matchObject(smallObj1, smallObj2);
		});
		bench('lodash.isMatch', function() {
			_.isMatch(smallObj1, smallObj2);
		});
	});

	compare('medium objects, match', function() {
		bench('objtools.matchObject', function() {
			objtools.matchObject(mediumObj1, mediumObj1);
		});
		bench('lodash.isMatch', function() {
			_.isMatch(mediumObj1, mediumObj1);
		});
	});

	compare('medium objects, no match', function() {
		bench('objtools.matchObject', function() {
			objtools.matchObject(mediumObj1, mediumObj2);
		});
		bench('lodash.isMatch', function() {
			_.isMatch(mediumObj1, mediumObj2);
		});
	});
});

benchset('Path functions', function() {
	let obj = { foo: { bar: [ { baz: 5 } ] } };

	bench('#getPath', function() {
		objtools.getPath(obj, 'foo.bar.0.baz');
	});

	bench('#setPath', function() {
		objtools.setPath(obj, 'foo.bar.0.baz', 5);
	});

	bench('#deletePath', function() {
		objtools.deletePath(obj, 'foo.bar.0');
	});
});

benchset('Scalar Functions', function() {
	const obj1 = { a: {
		b: [ 'c' ],
		d: 'e',
		f: { g: 'h' },
		i: 'jk',
		l: [ 'o', 'l' ]
	} };

	const obj2 = { a: {
		b: 'c',
		d: [ 'e' ],
		f: 'gh',
		i: { j: 'k' },
		l: { o: 'l' }
	} };

	bench('isScalar', function() {
		objtools.isScalar(obj1);
	});

	bench('scalarEquals', function() {
		objtools.scalarEquals(obj1, obj2);
	});
});

benchset('Dotted Functions', function() {
	const obj1 = { a: {
		b: [ 'c' ],
		d: 'e',
		f: { g: 'h' },
		i: 'jk',
		l: [ 'o', 'l' ]
	} };

	const obj2 = { a: {
		b: 'c',
		d: [ 'e' ],
		f: 'gh',
		i: { j: 'k' },
		l: { o: 'l' }
	} };

	bench('collapseToDotted', function() {
		objtools.collapseToDotted(obj1);
	});

	bench('matchDottedObject', function() {
		objtools.matchDottedObject(obj1, obj2);
	});
});
