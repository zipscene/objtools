"use strict";

exports.ObjectMask = require("./object-mask");

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
	return typeof o !== "object" || o instanceof Date || !o;
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
		for (var i = 0; i < a.length; i++) {
			if (!deepEquals(a[i], b[i])) return false;
		}
		return true;
	} else if (!Array.isArray(a) && !Array.isArray(b)) {
		for (var key in a) {
			if (!deepEquals(a[key], b[key])) return false;
		}
		for (var key in b) {
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
	if (a1 instanceof Date && a2 instanceof Date) return a1.getTime() === a2.getTime();
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
	var res;
	var i;
	var key;
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
	var result = {};
	if (isScalar(obj)) return {};
	function addObj(obj, path) {
		var key;
		if (isScalar(obj) || Array.isArray(obj) && stopAtArrays) {
			result[path] = obj;
			return;
		}
		if (includeRedundantLevels) {
			result[path] = obj;
		}
		for (key in obj) {
			addObj(obj[key], path ? path + "." + key : key);
		}
	}
	addObj(obj, "");
	delete result[""];
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
	var queryKey;
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
	var cur = obj;
	var parts = path.split(".");
	for (var i = 0; i < parts.length; i++) {
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
	var cur = obj;
	var parts = path.split(".");
	for (var i = 0; i < parts.length; i++) {
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
	var cur = obj;
	var parts = path.split(".");
	for (var i = 0; i < parts.length; i++) {
		if (isScalar(cur)) return undefined;
		if (Array.isArray(cur) && allowSkipArrays && !/^[0-9]+$/.test(parts[i]) && cur.length === 1) {
			cur = cur[0];
			i--;
		} else {
			cur = cur[parts[i]];
		}
	}
	return cur;
}
exports.getPath = getPath;
//# sourceMappingURL=data:application/json;base64,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R0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNkLEtBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDNUIsTUFBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDdEMsTUFBSSxDQUFDLEtBQUssS0FBSyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDM0IsTUFBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEtBQUssQ0FBQztHQUN0QixNQUFNO0FBQ04sT0FBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztBQUNoRCxNQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0dBQ3BCO0VBQ0Q7QUFDRCxRQUFPLEdBQUcsQ0FBQztDQUNYO0FBQ0QsT0FBTyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7Ozs7Ozs7Ozs7O0FBVzFCLFNBQVMsVUFBVSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUU7QUFDOUIsS0FBSSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ2QsS0FBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM1QixNQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN0QyxNQUFJLENBQUMsS0FBSyxLQUFLLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtBQUMzQixVQUFPLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztHQUNyQixNQUFNO0FBQ04sT0FBSSxRQUFRLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDNUIsV0FBTyxHQUFHLENBQUM7SUFDWDtBQUNELE1BQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7R0FDcEI7RUFDRDtBQUNELFFBQU8sR0FBRyxDQUFDO0NBQ1g7QUFDRCxPQUFPLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQzs7Ozs7Ozs7Ozs7Ozs7QUFjaEMsU0FBUyxPQUFPLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUU7QUFDNUMsS0FBSSxJQUFJLEtBQUssSUFBSSxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUUsT0FBTyxHQUFHLENBQUM7QUFDcEQsS0FBSSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ2QsS0FBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUM1QixNQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN0QyxNQUFJLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRSxPQUFPLFNBQVMsQ0FBQztBQUNwQyxNQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksZUFBZSxJQUFJLENBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQUFBQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQzlGLE1BQUcsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDYixJQUFDLEVBQUUsQ0FBQztHQUNKLE1BQU07QUFDTixNQUFHLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0dBQ3BCO0VBQ0Q7QUFDRCxRQUFPLEdBQUcsQ0FBQztDQUNYO0FBQ0QsT0FBTyxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMiLCJmaWxlIjoibGliL2luZGV4LmpzIiwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0cy5PYmplY3RNYXNrID0gcmVxdWlyZSgnLi9vYmplY3QtbWFzaycpO1xuXG4vKipcbiAqIEdlbmVyYWwgdXRpbGl0eSBmdW5jdGlvbnMgZm9yIG1hbmlwdWxhdGluZyBvYmplY3QuXG4gKlxuICogQGNsYXNzIG9ianRvb2xzXG4qL1xuXG4vKipcbiAqIERldGVybWluZXMgd2hldGhlciBhIHZhbHVlIGlzIGNvbnNpZGVyZWQgYSBzY2FsYXIgb3IgYW4gb2JqZWN0LiAgQ3VycmVudGx5LFxuICogcHJpbWl0aXZlcyBwbHVzIERhdGUgdHlwZXMgcGx1cyB1bmRlZmluZWQgYW5kIG51bGwgcGx1cyBmdW5jdGlvbnMgYXJlIGNvbnNpZGVyZWQgc2NhbGFyLlxuICpcbiAqIEBtZXRob2QgaXNTY2FsYXJcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7TWl4ZWR9IG8gLSBWYWx1ZSB0byBjaGVja1xuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuZnVuY3Rpb24gaXNTY2FsYXIobykge1xuXHRyZXR1cm4gdHlwZW9mIG8gIT09ICdvYmplY3QnIHx8IChvIGluc3RhbmNlb2YgRGF0ZSkgfHwgIW87XG59XG5leHBvcnRzLmlzU2NhbGFyID0gaXNTY2FsYXI7XG5cbi8qKlxuICogQ2hlY2tzIGZvciBkZWVwIGVxdWFsaXR5IGJldHdlZW4gdHdvIG9iamVjdCBvciB2YWx1ZXMuXG4gKlxuICogQG1ldGhvZCBkZWVwRXF1YWxzXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0ge01peGVkfSBhXG4gKiBAcGFyYW0ge01peGVkfSBiXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5mdW5jdGlvbiBkZWVwRXF1YWxzKGEsIGIpIHtcblx0aWYgKGlzU2NhbGFyKGEpICYmIGlzU2NhbGFyKGIpKSB7XG5cdFx0cmV0dXJuIHNjYWxhckVxdWFscyhhLCBiKTtcblx0fVxuXHRpZiAoYSA9PT0gbnVsbCB8fCBiID09PSBudWxsIHx8IGEgPT09IHVuZGVmaW5lZCB8fCBiID09PSB1bmRlZmluZWQpIHJldHVybiBhID09PSBiO1xuXHRpZiAoQXJyYXkuaXNBcnJheShhKSAmJiBBcnJheS5pc0FycmF5KGIpKSB7XG5cdFx0aWYgKGEubGVuZ3RoICE9PSBiLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYS5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKCFkZWVwRXF1YWxzKGFbaV0sIGJbaV0pKSByZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9IGVsc2UgaWYgKCFBcnJheS5pc0FycmF5KGEpICYmICFBcnJheS5pc0FycmF5KGIpKSB7XG5cdFx0Zm9yIChsZXQga2V5IGluIGEpIHtcblx0XHRcdGlmICghZGVlcEVxdWFscyhhW2tleV0sIGJba2V5XSkpIHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Zm9yIChsZXQga2V5IGluIGIpIHtcblx0XHRcdGlmICghZGVlcEVxdWFscyhhW2tleV0sIGJba2V5XSkpIHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gZWxzZSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5leHBvcnRzLmRlZXBFcXVhbHMgPSBkZWVwRXF1YWxzO1xuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIHR3byBzY2FsYXIgdmFsdWVzIChhcyBkZXRlcm1pbmVkIGJ5IGlzU2NhbGFyKCkpIGFyZSBlcXVhbC5cbiAqXG4gKiBAbWV0aG9kIHNjYWxhckVxdWFsc1xuICogQHN0YXRpY1xuICogQHBhcmFtIHtNaXhlZH0gYTEgLSBGaXJzdCB2YWx1ZVxuICogQHBhcmFtIHtNaXhlZH0gYTIgLSBTZWNvbmQgdmFsdWVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cbmZ1bmN0aW9uIHNjYWxhckVxdWFscyhhMSwgYTIpIHtcblx0aWYgKGExIGluc3RhbmNlb2YgRGF0ZSAmJiBhMiBpbnN0YW5jZW9mIERhdGUpIHJldHVybiAoYTEuZ2V0VGltZSgpID09PSBhMi5nZXRUaW1lKCkpO1xuXHRyZXR1cm4gYTEgPT09IGEyO1xufVxuZXhwb3J0cy5zY2FsYXJFcXVhbHMgPSBzY2FsYXJFcXVhbHM7XG5cbi8qKlxuICogUmV0dXJucyBhIGRlZXAgY29weSBvZiB0aGUgZ2l2ZW4gdmFsdWUgc3VjaCB0aGF0IGVudGl0aWVzIGFyZSBub3QgcGFzc2VkXG4gKiBieSByZWZlcmVuY2UuXG4gKlxuICogQG1ldGhvZCBkZWVwQ29weVxuICogQHN0YXRpY1xuICogQHBhcmFtIHtNaXhlZH0gb2JqIC0gVGhlIG9iamVjdCBvciB2YWx1ZSB0byBjb3B5XG4gKiBAcmV0dXJuIHtNaXhlZH1cbiAqL1xuZnVuY3Rpb24gZGVlcENvcHkob2JqKSB7XG5cdHZhciByZXM7XG5cdHZhciBpO1xuXHR2YXIga2V5O1xuXHRpZiAoaXNTY2FsYXIob2JqKSkgcmV0dXJuIG9iajtcblx0aWYgKEFycmF5LmlzQXJyYXkob2JqKSkge1xuXHRcdHJlcyA9IFtdO1xuXHRcdGZvciAoaSA9IDA7IGkgPCBvYmoubGVuZ3RoOyBpKyspIHtcblx0XHRcdHJlcy5wdXNoKGRlZXBDb3B5KG9ialtpXSkpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRyZXMgPSB7fTtcblx0XHRmb3IgKGtleSBpbiBvYmopIHtcblx0XHRcdHJlc1trZXldID0gZGVlcENvcHkob2JqW2tleV0pO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzO1xufVxuZXhwb3J0cy5kZWVwQ29weSA9IGRlZXBDb3B5O1xuXG4vKipcbiAqIEdpdmVuIGFuIG9iamVjdCwgY29udmVydHMgaXQgaW50byBhIG9uZS1sZXZlbC1kZWVwIG9iamVjdCB3aGVyZSB0aGUga2V5cyBhcmUgZG90LXNlcGFyYXRlZFxuICogcGF0aHMgYW5kIHRoZSB2YWx1ZXMgYXJlIHRoZSB2YWx1ZXMgYXQgdGhvc2UgcGF0aHMuXG4gKlxuICogQG1ldGhvZCBjb2xsYXBzZVRvRG90dGVkXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqIC0gVGhlIG9iamVjdCB0byBjb252ZXJ0XG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtpbmNsdWRlUmVkdW5kYW50TGV2ZWxzXSAtIElmIHNldCB0byB0cnVlLCB0aGUgcmV0dXJuZWQgb2JqZWN0IGFsc28gaW5jbHVkZXNcbiAqIGtleXMgZm9yIGludGVybmFsIG9iamVjdHMuICBCeSBkZWZhdWx0LCBhbiBvYmplY3Qgc3VjaCBhcyB7IGZvbzogeyBiYXI6IFwiYmF6XCJ9IH0gd2lsbCBiZSBjb252ZXJ0ZWRcbiAqIGludG8geyBcImZvby5iYXJcIjogXCJiYXpcIiB9LiAgSWYgaW5jbHVkZVJlZHVuZGFudExldmVscyBpcyBzZXQsIGl0IHdpbGwgaW5zdGVhZCBiZSBjb252ZXJ0ZWRcbiAqIGludG8geyBcImZvb1wiOiB7IGJhcjogXCJiYXpcIiB9LCBcImZvby5iYXJcIjogXCJiYXpcIiB9IC5cbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3N0b3BBdEFycmF5c10gLSBJZiBzZXQgdG8gdHJ1ZSwgdGhlIGNvbGxhcHNpbmcgZnVuY3Rpb24gd2lsbCBub3QgZGVzY2VuZCBpbnRvXG4gKiBhcnJheXMuXG4gKiBAZXhhbXBsZVxuICogICBCeSBkZWZhdWx0LCBhbiBvYmplY3Qgc3VjaCBhcyB7IGZvbzogWyBcImJhclwiLCBcImJhelwiIF0gfSBpcyBjb252ZXJ0ZWRcbiAqICAgaW50byB7IFwiZm9vLjBcIjogXCJiYXJcIiwgXCJmb28uMVwiOiBcImJhelwiIH0uICBJZiBzdG9wQXRBcnJheXMgaXMgc2V0LCB0aGlzIHdpbGwgaW5zdGVhZCBiZSBjb252ZXJ0ZWRcbiAqICAgaW50byB7IFwiZm9vXCI6IFsgXCJiYXJcIiwgXCJiYXpcIiBdIH0gLlxuICogQHJldHVybiB7T2JqZWN0fSAtIFRoZSByZXN1bHRcbiAqL1xuZnVuY3Rpb24gY29sbGFwc2VUb0RvdHRlZChvYmosIGluY2x1ZGVSZWR1bmRhbnRMZXZlbHMsIHN0b3BBdEFycmF5cykge1xuXHR2YXIgcmVzdWx0ID0ge307XG5cdGlmIChpc1NjYWxhcihvYmopKSByZXR1cm4ge307XG5cdGZ1bmN0aW9uIGFkZE9iaihvYmosIHBhdGgpIHtcblx0XHR2YXIga2V5O1xuXHRcdGlmIChpc1NjYWxhcihvYmopIHx8IChBcnJheS5pc0FycmF5KG9iaikgJiYgc3RvcEF0QXJyYXlzKSkge1xuXHRcdFx0cmVzdWx0W3BhdGhdID0gb2JqO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoaW5jbHVkZVJlZHVuZGFudExldmVscykge1xuXHRcdFx0cmVzdWx0W3BhdGhdID0gb2JqO1xuXHRcdH1cblx0XHRmb3IgKGtleSBpbiBvYmopIHtcblx0XHRcdGFkZE9iaihvYmpba2V5XSwgcGF0aCA/IChwYXRoICsgJy4nICsga2V5KSA6IGtleSk7XG5cdFx0fVxuXHR9XG5cdGFkZE9iaihvYmosICcnKTtcblx0ZGVsZXRlIHJlc3VsdFsnJ107XG5cdHJldHVybiByZXN1bHQ7XG59XG5leHBvcnRzLmNvbGxhcHNlVG9Eb3R0ZWQgPSBjb2xsYXBzZVRvRG90dGVkO1xuXG4vKipcbiAqIFJldHVybnMgd2hldGhlciBvciBub3QgdGhlIGdpdmVuIHF1ZXJ5IGZpZWxkcyAoaW4gZG90dGVkIG5vdGF0aW9uKSBtYXRjaCB0aGUgZG9jdW1lbnRcbiAqIChhbHNvIGluIGRvdHRlZCBub3RhdGlvbikuICBUaGUgXCJxdWVyaWVzXCIgaGVyZSBhcmUgc2ltcGxlIGVxdWFsaXR5IG1hdGNoZXMuXG4gKlxuICogQG1ldGhvZCBtYXRjaERvdHRlZE9iamVjdFxuICogQHN0YXRpY1xuICogQHBhcmFtIHtPYmplY3R9IGRvYyAtIFRoZSBkb2N1bWVudCB0byB0ZXN0XG4gKiBAcGFyYW0ge09iamVjdH0gcXVlcnkgLSBBIG9uZS1sYXllci1kZWVwIHNldCBvZiBrZXkvdmFsdWVzIHRvIGNoZWNrIGRvYyBmb3JcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gV2hldGhlciBvciBub3QgdGhlIGRvYyBtYXRjaGVzXG4gKi9cbmZ1bmN0aW9uIG1hdGNoRG90dGVkT2JqZWN0KGRvYywgcXVlcnkpIHtcblx0dmFyIHF1ZXJ5S2V5O1xuXHRpZiAocXVlcnkgPT09IHRydWUpIHJldHVybiBkb2MgPT09IHRydWU7XG5cdGlmIChpc1NjYWxhcihxdWVyeSkgfHwgaXNTY2FsYXIoZG9jKSkgcmV0dXJuIGRlZXBFcXVhbHMocXVlcnksIGRvYyk7XG5cdGZvciAocXVlcnlLZXkgaW4gcXVlcnkpIHtcblx0XHRpZiAoIWRlZXBFcXVhbHMoZG9jW3F1ZXJ5S2V5XSwgcXVlcnlbcXVlcnlLZXldKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn1cbmV4cG9ydHMubWF0Y2hEb3R0ZWRPYmplY3QgPSBtYXRjaERvdHRlZE9iamVjdDtcblxuLyoqXG4gKiBTYW1lIGFzIG1hdGNoRG90dGVkT2JqZWN0LCBidXQgYWxsb3dzIGZvciBub24tZG90dGVkIG9iamVjdHMgYW5kIHF1ZXJpZXMuXG4gKlxuICogQG1ldGhvZCBtYXRjaE9iamVjdFxuICogQHN0YXRpY1xuICogQHBhcmFtIHtPYmplY3R9IGRvYyAtIE9iamVjdCB0byBtYXRjaCBhZ2FpbnN0LCBpbiBzdHJ1Y3R1cmVkIChub3QgZG90dGVkKSBmb3JtXG4gKiBAcGFyYW0ge09iamVjdH0gcXVlcnkgLSBTZXQgb2YgZmllbGRzIChlaXRoZXIgZG90dGVkIG9yIHN0cnVjdHVyZWQpIHRvIG1hdGNoXG4gKiBAcmV0dXJuIHtCb29sZWFufSAtIFdoZXRoZXIgb3Igbm90IHRoZSBvYmplY3QgbWF0Y2hlc1xuICovXG5mdW5jdGlvbiBtYXRjaE9iamVjdChkb2MsIHF1ZXJ5KSB7XG5cdHJldHVybiBtYXRjaERvdHRlZE9iamVjdChleHBvcnRzLmNvbGxhcHNlVG9Eb3R0ZWQoZG9jKSwgZXhwb3J0cy5jb2xsYXBzZVRvRG90dGVkKHF1ZXJ5KSk7XG59XG5leHBvcnRzLm1hdGNoT2JqZWN0ID0gbWF0Y2hPYmplY3Q7XG5cbi8qKlxuICogU2V0cyB0aGUgdmFsdWUgYXQgYSBnaXZlbiBwYXRoIGluIGFuIG9iamVjdC5cbiAqXG4gKiBAbWV0aG9kIHNldFBhdGhcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogLSBUaGUgb2JqZWN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCAtIFRoZSBwYXRoLCBkb3Qtc2VwYXJhdGVkXG4gKiBAcGFyYW0ge01peGVkfSB2YWx1ZSAtIFZhbHVlIHRvIHNldFxuICogQHJldHVybiB7T2JqZWN0fSAtIFRoZSBzYW1lIG9iamVjdFxuICovXG5mdW5jdGlvbiBzZXRQYXRoKG9iaiwgcGF0aCwgdmFsdWUpIHtcblx0dmFyIGN1ciA9IG9iajtcblx0dmFyIHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHBhcnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0aWYgKGkgPT09IHBhcnRzLmxlbmd0aCAtIDEpIHtcblx0XHRcdGN1cltwYXJ0c1tpXV0gPSB2YWx1ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKGlzU2NhbGFyKGN1cltwYXJ0c1tpXV0pKSBjdXJbcGFydHNbaV1dID0ge307XG5cdFx0XHRjdXIgPSBjdXJbcGFydHNbaV1dO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gb2JqO1xufVxuZXhwb3J0cy5zZXRQYXRoID0gc2V0UGF0aDtcblxuLyoqXG4gKiBEZWxldGVzIHRoZSB2YWx1ZSBhdCBhIGdpdmVuIHBhdGggaW4gYW4gb2JqZWN0LlxuICpcbiAqIEBtZXRob2QgZGVsZXRlUGF0aFxuICogQHN0YXRpY1xuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEByZXR1cm4ge09iamVjdH0gLSBUaGUgb2JqZWN0IHRoYXQgd2FzIHBhc3NlZCBpblxuICovXG5mdW5jdGlvbiBkZWxldGVQYXRoKG9iaiwgcGF0aCkge1xuXHR2YXIgY3VyID0gb2JqO1xuXHR2YXIgcGFydHMgPSBwYXRoLnNwbGl0KCcuJyk7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgcGFydHMubGVuZ3RoOyBpKyspIHtcblx0XHRpZiAoaSA9PT0gcGFydHMubGVuZ3RoIC0gMSkge1xuXHRcdFx0ZGVsZXRlIGN1cltwYXJ0c1tpXV07XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChpc1NjYWxhcihjdXJbcGFydHNbaV1dKSkge1xuXHRcdFx0XHRyZXR1cm4gb2JqO1xuXHRcdFx0fVxuXHRcdFx0Y3VyID0gY3VyW3BhcnRzW2ldXTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIG9iajtcbn1cbmV4cG9ydHMuZGVsZXRlUGF0aCA9IGRlbGV0ZVBhdGg7XG5cbi8qKlxuICogR2V0cyB0aGUgdmFsdWUgYXQgYSBnaXZlbiBwYXRoIGluIGFuIG9iamVjdC5cbiAqXG4gKiBAbWV0aG9kIGdldFBhdGhcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogLSBUaGUgb2JqZWN0XG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCAtIFRoZSBwYXRoLCBkb3Qtc2VwYXJhdGVkXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGFsbG93U2tpcEFycmF5cyAtIElmIHRydWU6IElmIGEgZmllbGQgaW4gYW4gb2JqZWN0IGlzIGFuIGFycmF5IGFuZCB0aGVcbiAqIHBhdGgga2V5IGlzIG5vbi1udW1lcmljLCBhbmQgdGhlIGFycmF5IGhhcyBleGFjdGx5IDEgZWxlbWVudCwgdGhlbiB0aGUgZmlyc3QgZWxlbWVudFxuICogb2YgdGhlIGFycmF5IGlzIHVzZWQuXG4gKiBAcmV0dXJuIHtNaXhlZH0gLSBUaGUgdmFsdWUgYXQgdGhlIHBhdGhcbiAqL1xuZnVuY3Rpb24gZ2V0UGF0aChvYmosIHBhdGgsIGFsbG93U2tpcEFycmF5cykge1xuXHRpZiAocGF0aCA9PT0gbnVsbCB8fCBwYXRoID09PSB1bmRlZmluZWQpIHJldHVybiBvYmo7XG5cdHZhciBjdXIgPSBvYmo7XG5cdHZhciBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuXHRcdGlmIChpc1NjYWxhcihjdXIpKSByZXR1cm4gdW5kZWZpbmVkO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGN1cikgJiYgYWxsb3dTa2lwQXJyYXlzICYmICEoL15bMC05XSskLy50ZXN0KHBhcnRzW2ldKSkgJiYgY3VyLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y3VyID0gY3VyWzBdO1xuXHRcdFx0aS0tO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjdXIgPSBjdXJbcGFydHNbaV1dO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gY3VyO1xufVxuZXhwb3J0cy5nZXRQYXRoID0gZ2V0UGF0aDtcblxuIl19