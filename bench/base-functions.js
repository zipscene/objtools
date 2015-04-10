let { benchset, compare, bench } = require('spectrophotometer');
let objtools = require('../lib');
let _ = require('lodash');

benchset('#merge', function() {

	compare('small objects', function() {

		const obj1 = {
			foo: 1,
			bar: {
				zip: 3
			}
		};

		const obj2 = {
			foo: 3,
			zip: 4,
			bar: {
				bam: 4
			}
		};

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

benchset('Path functions', function() {

	let obj = {
		foo: {
			bar: [ {
				baz: 5
			} ]
		}
	};

	bench('#getPath', function() {
		objtools.getPath(obj, 'foo.bar.0.baz');
	});

	bench('#setPath', function() {
		objtools.setPath(obj, 'foo.bar.0.baz', 5);
	});

});
