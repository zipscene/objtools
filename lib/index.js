exports.ObjectMask = require('./object-mask');
let _ = require('lodash');

/**
 * General utility functions for manipulating object.
 *
 * @class objtools
*/

/**
 * Determines whether a value is considered a scalar or an object.  Currently,
 * primitives plus Date types plus undefined and null plus functions are considered scalar.
 *
 * @method isScalar
 * @static
 * @param {Mixed} o - Value to check
 * @return {Boolean}
 */
function isScalar(o) {
	return typeof o !== 'object' || (o instanceof Date) || !o;
}
exports.isScalar = isScalar;

/**
 * Checks for deep equality between two object or values.
 *
 * @method deepEquals
 * @static
 * @param {Mixed} a
 * @param {Mixed} b
 * @return {Boolean}
 */
function deepEquals(a, b) {
	if (isScalar(a) && isScalar(b)) {
		return scalarEquals(a, b);
	}
	if (a === null || b === null || a === undefined || b === undefined) return a === b;
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!deepEquals(a[i], b[i])) return false;
		}
		return true;
	} else if (!Array.isArray(a) && !Array.isArray(b)) {
		for (let key in a) {
			if (!deepEquals(a[key], b[key])) return false;
		}
		for (let key in b) {
			if (!deepEquals(a[key], b[key])) return false;
		}
		return true;
	} else {
		return false;
	}
}
exports.deepEquals = deepEquals;

/**
 * Checks whether two scalar values (as determined by isScalar()) are equal.
 *
 * @method scalarEquals
 * @static
 * @param {Mixed} a1 - First value
 * @param {Mixed} a2 - Second value
 * @return {Boolean}
 */
function scalarEquals(a1, a2) {
	if (a1 instanceof Date && a2 instanceof Date) return (a1.getTime() === a2.getTime());
	return a1 === a2;
}
exports.scalarEquals = scalarEquals;

/**
 * Returns a deep copy of the given value such that entities are not passed
 * by reference.
 *
 * @method deepCopy
 * @static
 * @param {Mixed} obj - The object or value to copy
 * @return {Mixed}
 */
function deepCopy(obj) {
	let res;
	let i;
	let key;
	if (isScalar(obj)) return obj;
	if (Array.isArray(obj)) {
		res = [];
		for (i = 0; i < obj.length; i++) {
			res.push(deepCopy(obj[i]));
		}
	} else {
		res = {};
		for (key in obj) {
			res[key] = deepCopy(obj[key]);
		}
	}
	return res;
}
exports.deepCopy = deepCopy;

/**
 * Given an object, converts it into a one-level-deep object where the keys are dot-separated
 * paths and the values are the values at those paths.
 *
 * @method collapseToDotted
 * @static
 * @param {Object} obj - The object to convert
 * @param {Boolean} [includeRedundantLevels] - If set to true, the returned object also includes
 * keys for internal objects.  By default, an object such as { foo: { bar: "baz"} } will be converted
 * into { "foo.bar": "baz" }.  If includeRedundantLevels is set, it will instead be converted
 * into { "foo": { bar: "baz" }, "foo.bar": "baz" } .
 * @param {Boolean} [stopAtArrays] - If set to true, the collapsing function will not descend into
 * arrays.
 * @example
 *   By default, an object such as { foo: [ "bar", "baz" ] } is converted
 *   into { "foo.0": "bar", "foo.1": "baz" }.  If stopAtArrays is set, this will instead be converted
 *   into { "foo": [ "bar", "baz" ] } .
 * @return {Object} - The result
 */
function collapseToDotted(obj, includeRedundantLevels, stopAtArrays) {
	let result = {};
	if (isScalar(obj)) return {};
	function addObj(obj, path) {
		let key;
		if (isScalar(obj) || (Array.isArray(obj) && stopAtArrays)) {
			result[path] = obj;
			return;
		}
		if (includeRedundantLevels) {
			result[path] = obj;
		}
		for (key in obj) {
			addObj(obj[key], path ? (path + '.' + key) : key);
		}
	}
	addObj(obj, '');
	delete result[''];
	return result;
}
exports.collapseToDotted = collapseToDotted;

/**
 * Returns whether or not the given query fields (in dotted notation) match the document
 * (also in dotted notation).  The "queries" here are simple equality matches.
 *
 * @method matchDottedObject
 * @static
 * @param {Object} doc - The document to test
 * @param {Object} query - A one-layer-deep set of key/values to check doc for
 * @return {Boolean} - Whether or not the doc matches
 */
function matchDottedObject(doc, query) {
	let queryKey;
	if (query === true) return doc === true;
	if (isScalar(query) || isScalar(doc)) return deepEquals(query, doc);
	for (queryKey in query) {
		if (!deepEquals(doc[queryKey], query[queryKey])) {
			return false;
		}
	}
	return true;
}
exports.matchDottedObject = matchDottedObject;

/**
 * Same as matchDottedObject, but allows for non-dotted objects and queries.
 *
 * @method matchObject
 * @static
 * @param {Object} doc - Object to match against, in structured (not dotted) form
 * @param {Object} query - Set of fields (either dotted or structured) to match
 * @return {Boolean} - Whether or not the object matches
 */
function matchObject(doc, query) {
	return matchDottedObject(exports.collapseToDotted(doc), exports.collapseToDotted(query));
}
exports.matchObject = matchObject;

/**
 * Synchronizes one object to another object, in-place.  Updates to the existing object
 * are done in-place as much as possible.  Full objects are only replaced if necessary.
 *
 * @method syncObject
 * @static
 * @param {Object} toObj - The object to modify
 * @param {Object} fromObj - The object to copy from
 * @param {Object} [options]
 * @param {Function} options.onField - An optional callback to call whenever a field
 * is traversed during this function.  If it returns a boolean `false`, any modification is
 * prevented and further subfields will not be traversed.
 * @param {String} options.onField.field - The field name (dot-separated notation)
 * @param {Mixed} options.onField.toVal - What the field is being changed to
 * @param {Mixed} options.onField.fromVal - What the field used to be
 * @param {Object} options.onField.parentObj - The immediate parent object containing the field
 * @param {Function} options.onChange - Optional function to be called when a value changes.
 * @param {String} options.onChange.field - The field name (dot-separated notation)
 * @param {Mixed} options.onChange.toVal - What the field is being changed to
 * @param {Mixed} options.onChange.fromVal - What the field used to be
 * @param {Object} options.onChange.parentObj - The immediate parent object containing the field
 * @return {Object} - The resulting object (usually the same object as toObj)
 */
function syncObject(toObj, fromObj, options = {}) {

	function syncSubObject(toObj, fromObj, path) {
		for (let key in fromObj) {
			if (!fromObj.hasOwnProperty(key)) continue;
			let toVal = toObj[key];
			let fromVal = fromObj[key];
			let keyPath = path ? (path + '.' + key) : key;
			if (options.onField && options.onField(keyPath, toVal, fromVal, toObj) === false) {
				continue;
			}
			if (
				typeof toVal !== 'object' ||
				!toVal ||
				Array.isArray(toVal) ||
				typeof fromVal !== 'object' ||
				!fromVal ||
				Array.isArray(fromVal)
			) {
				// We're replacing a blank field or a field that isn't an object, or replacing it
				// with a non-object, so just set the value
				if (!scalarEquals(fromVal, toVal)) {
					if (options.onChange) {
						options.onChange(keyPath, toVal, fromVal, toObj);
					}
					toObj[key] = fromVal;
				}
			} else {
				// Both are objects, so recurse
				syncSubObject(toVal, fromVal, keyPath);
			}
		}
		for (let key in toObj) {
			if (!toObj.hasOwnProperty(key)) continue;
			let keyPath = path ? (path + '.' + key) : key;
			if (options.onField && options.onField(keyPath, undefined, toObj[key], toObj) === false) {
				continue;
			}
			// Look for keys in toObj that don't exist in fromObj (for deletion)
			if (fromObj[key] === undefined) {
				if (options.onChange) {
					options.onChange(keyPath, undefined, toObj[key], toObj);
				}
				delete toObj[key];
			}
		}
	}

	syncSubObject(toObj, fromObj, '');
	return toObj;
}
exports.syncObject = syncObject;

/**
 * Sets the value at a given path in an object.
 *
 * @method setPath
 * @static
 * @param {Object} obj - The object
 * @param {String} path - The path, dot-separated
 * @param {Mixed} value - Value to set
 * @return {Object} - The same object
 */
function setPath(obj, path, value) {
	let cur = obj;
	let parts = path.split('.');
	for (let i = 0; i < parts.length; i++) {
		if (i === parts.length - 1) {
			cur[parts[i]] = value;
		} else {
			if (isScalar(cur[parts[i]])) cur[parts[i]] = {};
			cur = cur[parts[i]];
		}
	}
	return obj;
}
exports.setPath = setPath;

/**
 * Deletes the value at a given path in an object.
 *
 * @method deletePath
 * @static
 * @param {Object} obj
 * @param {String} path
 * @return {Object} - The object that was passed in
 */
function deletePath(obj, path) {
	let cur = obj;
	let parts = path.split('.');
	for (let i = 0; i < parts.length; i++) {
		if (i === parts.length - 1) {
			delete cur[parts[i]];
		} else {
			if (isScalar(cur[parts[i]])) {
				return obj;
			}
			cur = cur[parts[i]];
		}
	}
	return obj;
}
exports.deletePath = deletePath;

/**
 * Gets the value at a given path in an object.
 *
 * @method getPath
 * @static
 * @param {Object} obj - The object
 * @param {String} path - The path, dot-separated
 * @param {Boolean} allowSkipArrays - If true: If a field in an object is an array and the
 * path key is non-numeric, and the array has exactly 1 element, then the first element
 * of the array is used.
 * @return {Mixed} - The value at the path
 */
function getPath(obj, path, allowSkipArrays) {
	if (path === null || path === undefined) return obj;
	let cur = obj;
	let parts = path.split('.');
	for (let i = 0; i < parts.length; i++) {
		if (isScalar(cur)) return undefined;
		if (Array.isArray(cur) && allowSkipArrays && !(/^[0-9]+$/.test(parts[i])) && cur.length === 1) {
			cur = cur[0];
			i--;
		} else {
			cur = cur[parts[i]];
		}
	}
	return cur;
}
exports.getPath = getPath;

/**
 * Deeply merges n objects
 *
 * @method merge
 * @static
 * @param {Object} object - the destination object
 * @param {Object} sources - the source object
 * @param {Function} customizer - the function to customize merging properties
 *		If provided, customizer is invoked to produce the merged values of the destination and source
 *		properties. If customizer returns undefined, merging is handled by the method instead. The
 *		customizer is invoked with five arguments: (objectValue, sourceValue, key, object, source).
 * @return {Object} - the merged object
 */
function merge(object, ...sources) {
	let customizer, lastSource = sources[sources.length - 1];
	if (sources.length > 1 && typeof lastSource === 'function') {
		customizer = sources.pop();
		lastSource = sources[sources.length - 1];
	}
	// check if merge is being used w/ map, reduce or similar
	if (sources.length > 1 && _.isArray(lastSource) && lastSource.indexOf(sources[0]) >= 0) {
		baseMerge(object, sources[0], customizer);
	} else {
		for (let source of sources) {
			baseMerge(object, source, customizer);
		}
	}
	return object;
}
function baseMerge(object, source, customizer) {
	if (!isScalar(object)) {
		for (let key in source) {
			let srcValue = source[key];
			if (isScalar(srcValue)) {
				let value = object[key];
				let result = customizer ? customizer(value, srcValue, key, object, source) : undefined;
				// isCommon => use source value instead of customizer result
				let isCommon = result === undefined;
				if (isCommon) {
					result = srcValue;
				}
				let hasValue = _.isArray(source) || result !== undefined;
				let isNewValue = result !== value && !(isNaN(result) && isNaN(value));
				if (hasValue && (isCommon || isNewValue)) {
					object[key] = result;
				}
			} else {
				baseMergeDeep(object, source, key, customizer);
			}
		}
	}
	return object;
}
function baseMergeDeep(object, source, key, customizer) {
	let srcValue = source[key];
	let value = object[key];
	let result = customizer && customizer(value, srcValue, key, object, source);
	let isCommon = (typeof result === 'undefined');
	if (isCommon) {
		result = srcValue;
		if (_.isArray(srcValue)) {
			if (_.isArray(value)) {
				result = value;
			} else if (value && value.length) {
				result = _.toArray(value);
			} else {
				result = [];
			}
		} else if (_.isPlainObject(srcValue) || _.isArguments(srcValue)) {
			if (_.isArguments(value)) {
				result = _.toPlainObject(value);
			} else if (_.isArray(value) || _.isPlainObject(value)) {
				result = value;
			} else {
				result = {};
			}
		} else {
			isCommon = false;
		}
	}
	// Recursively merge objects and arrays (susceptible to call stack limits).
	if (isCommon) {
		object[key] = baseMerge(result, srcValue, customizer);
	} else if (result !== value) {
		object[key] = result;
	}
}
exports.merge = merge;

/**
 * Diffs n objects
 *
 * @method diffObjects
 * @static
 * @param {Object} ...objects - the objects to diff
 * @return {Object} - TODO
 */
const isCollectionOrNull = val => (!isScalar(val) || val === null);
const hasScalars = vals => _.any(vals, isScalar);
const isDiffRelevant = diff => (!diff.every(isCollectionOrNull) && hasScalars(diff));
const getValueAtKeyOrNull = key => obj => _.has(obj, key) ? obj[key] : null;
const getDuplicates = arr => _(arr).countBy().omit(count => count < 2).keys().value();
const getKeys = (...objects) => _(objects).reject(isScalar).map(_.keys).flatten().value();
const getDuplicateKeys = _.compose(getDuplicates, getKeys);
const isValueAtKeyEqual = (objects, key) => obj => (obj && objects[0] && obj[key] === objects[0][key]);
const isHeterogeneousAtKey = objects => key => !_.every(objects, isValueAtKeyEqual(objects, key));
function diffObjects(...objects) {
	const handleOverlappingKeys = diffValues => isDiffRelevant(diffValues)
		? _.extend(diffValues, exports.diffObjects(...diffValues))
		: exports.diffObjects(...diffValues);

	const diffKeysReducer = (result, key) => {
		let diffValues = objects.map(getValueAtKeyOrNull(key));
		result[key] = getDuplicateKeys(...diffValues).length
			? handleOverlappingKeys(diffValues)
			: diffValues;
		return result;
	};

	let result = objects.every(isCollectionOrNull)
		? {}
		: objects.map(val => isScalar(val) ? val : null);

	return getKeys(...objects)
		.filter(isHeterogeneousAtKey(objects))
		.reduce(diffKeysReducer, result);
}
exports.diffObjects = diffObjects;

function dottedDiff(a, b) {
	const dottedA = collapseToDotted(a);
	const dottedB = collapseToDotted(b);
	let aKeys = _.keys(dottedA);
	let bKeys = _.keys(dottedB);
	let allKeys = _.union(aKeys, bKeys);
	let sameKeys = _.intersection(aKeys, bKeys);
	let diffKeys = _.difference(allKeys, sameKeys);
	for (let index in diffKeys) {
		let pathArray = diffKeys[index].split('.');
		// get the shortest path that only exists in one object
		while (pathArray.length > 1) {
			pathArray = pathArray.slice(0, -1);
			let newPath = pathArray.join('.');
			let aVal = getPath(a, newPath);
			let bVal = getPath(b, newPath);
			if (isScalar(aVal) || isScalar(bVal)) {
				diffKeys[index] = pathArray.join('.');
			} else {
				break;
			}
		}
	}
	let result = diffKeys;
	for (let key of sameKeys) {
		let aAtKey = getPath(a, key);
		let bAtKey = getPath(b, key);
		let bothScalar = isScalar(aAtKey) && isScalar(bAtKey);
		let onlyOneScalar = (isScalar(aAtKey) && !isScalar(bAtKey)) || (isScalar(bAtKey) && !isScalar(aAtKey));
		if (bothScalar && aAtKey !== bAtKey || onlyOneScalar) {
			result.push(key);
		} else {
			let paths = key.split('.');
			while ((getPath(a, key) !== getPath(b, key)) && paths.length) {
				paths = paths.slice(0, -1);
				console.dir(paths);
				let newkey = paths.join('.');
				if ((getPath(a, key) !== getPath(b, key))) {
					key = newkey;
				}
			}
			if (!_.isEqual(getPath(a, key), getPath(b, key))) {
				result.push(key);
			}
		}
	}
	return _.uniq(result);
}
exports.dottedDiff = dottedDiff;
