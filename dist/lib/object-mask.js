"use strict";

var _core = require("babel-runtime/core-js").default;

var objtools = require("./index");

/**
 * This class represents a mask, or whitelist, of fields on an object.  Such
 * a mask is stored in a format that looks like this:
 *
 * { foo: true, bar: { baz: true } }
 *
 * This mask applies to the properties "foo" and "bar.baz" on an object.
 * Wilcards can also be used:
 *
 * { foo: false, bar: false, _: true }
 *
 * This will allow all fields but foo and bar.  The use of arrays with
 * a single element is equivalent to the use of wildcards, as arrays in
 * the masked object are treated as objects with numeric keys.  These
 * two masks are equivalent:
 *
 * { foo: [ { bar: true, baz: true } ] }
 *
 * { foo: { _: { bar: true, baz: true } } }
 *
 * @class ObjectMask
 * @constructor
 * @param {Object} mask - The data for the mask
 */
function ObjectMask(mask) {
	this.mask = mask;
}
module.exports = ObjectMask;

/**
 * Returns a copy of the given object, but only including the fields allowed by
 * the mask.  If the maskedOutHook function is provided, it is called for
 * each field disallowed by the mask (at the highest level it is disallowed).
 *
 * @method filterObject
 * @param {Object} obj - Object to filter
 * @param {Function} [maskedOutHook] - Function to call for fields disallowed
 * by the mask
 * @param {String} maskedOutHook.path - Path on the object that was masked out
 * @return {Object} - The object after removing masked out fields.  Note that
 * the returned object may still contain references to the original object.
 * Fields that are not masked out are copied by reference.
 */
ObjectMask.prototype.filterObject = function (obj, maskedOutHook) {
	var mask = this.mask;
	function filter(obj, mask, path) {
		if (mask === true) return obj;
		if (!mask || objtools.isScalar(obj)) {
			if (maskedOutHook) maskedOutHook(path);
			return undefined;
		}
		if (Array.isArray(mask)) {
			mask = { _: mask[0] || false };
		}
		if (typeof mask === "object") {
			var resultIsArray = Array.isArray(obj);
			var resultObj = resultIsArray ? [] : {};
			var maskVal = undefined,
			    resultVal = undefined;
			for (var key in obj) {
				maskVal = mask[key] === undefined ? mask._ : mask[key];
				resultVal = filter(obj[key], maskVal || false, path ? path + "." + key : key);
				if (resultVal !== undefined) {
					if (resultIsArray) resultObj.push(resultVal);else resultObj[key] = resultVal;
				}
			}
			return resultObj;
		} else {
			if (maskedOutHook) maskedOutHook(path);
			return undefined;
		}
	}
	return filter(obj, mask, "");
};

/**
 * Returns a subsection of a mask given a dot-separated path to the subsection.
 *
 * @method getSubMask
 * @param {String} path - Dot-separated path to submask to fetch
 * @return {ObjectMask} - Mask component corresponding to the path
 */
ObjectMask.prototype.getSubMask = function (path) {
	var mask = this.mask;
	var parts = path.split(".");
	var cur = mask;
	for (var partIdx = 0; partIdx < parts.length; partIdx++) {
		if (cur === true) return true;
		if (objtools.isScalar(cur)) return false;
		if (Array.isArray(cur)) cur = { _: cur[0] || false };
		var part = parts[partIdx];
		cur = cur[part] === undefined ? cur._ : cur[part];
	}
	return new ObjectMask(cur || false);
};

/**
 * Returns true if the given path is allowed by the mask.  false otherwise.
 *
 * @method checkMaskPath
 * @param {String} path - Dot-separated path
 * @return {Boolean} - Whether or not the given path is allowed
 */
ObjectMask.prototype.checkPath = function (path) {
	return this.getSubMask(path).mask === true;
};

/**
 * Returns the internal object that represents this mask.
 *
 * @method toObject
 * @return {Object} - Object representation of this mask
 */
ObjectMask.prototype.toObject = function () {
	return this.mask;
};

/**
 * Combines two or more masks such that the result mask matches fields matched by
 * any of the combined masks.
 *
 * @method addMasks
 * @static
 * @param {ObjectMask|Object} mask1
 * @param {ObjectMask|Object} mask2...
 * @return {ObjectMask} - The result of adding together the component masks
 */
ObjectMask.addMasks = function () {
	var resultMask = false;

	// Adds a single mask (fromMask) into the resultMask mask in-place.  toMask should be an object.
	// If the resulting mask is a boolean true, this function returns true.  Otherwise, it returns toMask.
	function addMask(resultMask, newMask) {
		var key = undefined;

		if (resultMask === true) return true;
		if (newMask === true) {
			resultMask = true;
			return resultMask;
		}
		if (objtools.isScalar(newMask)) return resultMask;
		if (objtools.isScalar(resultMask)) {
			resultMask = objtools.deepCopy(newMask);
			return resultMask;
		}

		if (Array.isArray(resultMask)) {
			resultMask = { _: resultMask[0] || false };
		}
		if (Array.isArray(newMask)) {
			newMask = { _: newMask[0] || false };
		}

		// If there are keys that exist in result but not in the newMask,
		// and the result mask has a _ key (wildcard), combine
		// the wildcard mask with the new mask, because in the existing
		// result mask, that key has the wildcard permissions
		if (newMask._ !== undefined) {
			for (key in resultMask) {
				if (key === "_") continue;
				if (newMask[key] === undefined) {
					resultMask[key] = addMask(resultMask[key], newMask._);
				}
			}
		}

		// same here ... also, copy over or merge fields
		for (key in newMask) {
			if (key === "_") continue;
			if (resultMask[key] !== undefined) {
				resultMask[key] = addMask(resultMask[key], newMask[key]);
			} else if (resultMask._ !== undefined) {
				resultMask[key] = addMask(objtools.deepCopy(newMask[key]), resultMask._);
			} else {
				resultMask[key] = objtools.deepCopy(newMask[key]);
			}
		}
		// fill in the _ key that we skipped earlier
		if (newMask._ !== undefined) {
			if (resultMask._ !== undefined) {
				resultMask._ = addMask(resultMask._, newMask._);
			} else {
				resultMask._ = objtools.deepCopy(newMask._);
			}
		}

		// If there is a wildcard, remove any keys that are set to the same thing as the wildcard
		// This isn't strictly necessary, but removes redundant data
		if (resultMask._ !== undefined) {
			for (key in resultMask) {
				if (key !== "_" && objtools.deepEquals(resultMask[key], resultMask._)) {
					delete resultMask[key];
				}
			}
		}

		return resultMask || false;
	}

	var curArg = undefined;
	for (var argIdx = 0; argIdx < arguments.length; argIdx++) {
		curArg = arguments[argIdx];
		if (curArg instanceof ObjectMask) {
			curArg = curArg.toObject();
		}
		resultMask = addMask(resultMask, curArg);
		if (resultMask === true) return true;
	}
	return new ObjectMask(resultMask || false);
};

/**
 * Adds a set of masks together, but using a logical AND instead of a logical OR (as in addMasks).
 * IE, a field must be allowed in all given masks to be in the result mask.
 *
 * @method andMasks
 * @static
 * @param {ObjectMask|Object} mask1
 * @param {ObjectMask|Object} mask2...
 * @return {ObjectMask} - The result of ANDing together the component masks
 */
ObjectMask.andMasks = function () {
	var resultMask = true;

	function andMask(resultMask, newMask) {
		var key = undefined;

		// Degenerate cases
		if (resultMask === true) return objtools.deepCopy(newMask);
		if (newMask === true) return resultMask;
		if (objtools.isScalar(resultMask) || objtools.isScalar(newMask)) return false;

		// Resolve arrays
		if (Array.isArray(resultMask)) {
			resultMask = { _: resultMask[0] || false };
		}
		if (Array.isArray(newMask)) {
			newMask = { _: newMask[0] || false };
		}

		// Handle keys that exist in both masks, excepting _
		for (key in newMask) {
			if (key === "_") continue;
			if (resultMask[key] !== undefined) {
				resultMask[key] = andMask(resultMask[key], newMask[key]);
			}
		}

		// Handle keys that exist in resultMask but not in newMask
		for (key in resultMask) {
			if (key === "_") continue;
			if (newMask[key] === undefined) {
				if (newMask._ !== undefined) {
					resultMask[key] = andMask(resultMask[key], newMask._);
				} else {
					resultMask[key] = false;
				}
			}
		}

		// Handle keys that exist in newMask but not resultMask
		for (key in newMask) {
			if (key === "_") continue;
			if (resultMask[key] === undefined) {
				if (resultMask._ !== undefined) {
					resultMask[key] = andMask(objtools.deepCopy(newMask[key]), resultMask._);
				} else {
					resultMask[key] = false;
				}
			}
		}

		// Handle _ (wildcard fields)
		if (newMask._ !== undefined && resultMask._ !== undefined) {
			resultMask._ = andMask(resultMask._, newMask._);
		} else {
			delete resultMask._;
		}

		// To condense some cases, remove unnecessary falsy values
		if (!resultMask._) {
			delete resultMask._;
			// Since all values will default to false, we can remove any falsy values
			for (key in resultMask) {
				if (!resultMask[key]) {
					delete resultMask[key];
				}
			}
		}

		// If there are no keys left in resultMask, condense to false
		if (!_core.Object.keys(resultMask).length) return false;

		return resultMask;
	}

	var curArg = undefined;
	for (var argIdx = 0; argIdx < arguments.length; argIdx++) {
		curArg = arguments[argIdx];
		if (curArg instanceof ObjectMask) {
			curArg = curArg.toObject();
		}
		resultMask = andMask(resultMask, curArg);
		if (resultMask === false) return false;
	}
	return new ObjectMask(resultMask || false);
};

/**
 * Check if a mask is valid in strict form (ie, it only contains objects and booleans)
 *
 * @method validate
 * @return {Boolean} - Whether or not the mask is strictly valid
 */
ObjectMask.prototype.validate = function () {
	function valWhitelist(whitelist) {
		if (whitelist !== true && whitelist !== false && objtools.isScalar(whitelist)) return false;
		if (typeof whitelist === "object") {
			for (var key in whitelist) {
				if (!valWhitelist(whitelist[key])) return false;
			}
		}
		return true;
	}
	return valWhitelist(this.mask);
};

/**
 * Returns an array of fields in the given object which are restricted by the given mask
 *
 * @method getMaskedOutFields
 * @param {Object} obj - The object to check against
 * @return {String[]} - Paths to fields that are restricted by the mask
 */
ObjectMask.prototype.getMaskedOutFields = function (obj) {
	var maskedOut = [];
	this.filterObject(obj, function (path) {
		maskedOut.push(path);
	});
	return maskedOut;
};

/**
 * Given a dot-notation mapping from fields to values, remove all fields that are not
 * allowed by the mask.
 *
 * @method filterDottedObject
 * @param {Object} dottedObj - Map from dotted paths to values, such as { "foo.bar": "baz" }
 * @param {Function} [maskedOutHook] - Function to call for removed fields
 * @param {String} maskedOutHook.path - Path of the masked out field
 * @return {Object} - The result
 */
ObjectMask.prototype.filterDottedObject = function (dottedObj, maskedOutHook) {
	var resultObj = {};
	for (var key in dottedObj) {
		if (!this.checkPath(key)) {
			if (maskedOutHook) {
				maskedOutHook(key);
			}
		} else {
			resultObj[key] = dottedObj[key];
		}
	}
	return resultObj;
};

/**
 * Returns an array of fields in the given object which are restricted by the given mask.  The
 * object is in dotted notation as in filterDottedObject()
 *
 * @method getDottedMaskedOutFields
 * @param {Object} obj - The object to check against
 * @return {String[]} - Paths to fields that are restricted by the mask
 */
ObjectMask.prototype.getDottedMaskedOutFields = function (obj) {
	var maskedOut = [];
	this.filterDottedObject(obj, function (path) {
		maskedOut.push(path);
	});
	return maskedOut;
};

/**
 * Given a structured document, ensures that
 * all fields are allowed by the given mask.  Returns true or false.
 *
 * @method checkFields
 * @param {Object} obj
 * @return {Boolean}
 */
ObjectMask.prototype.checkFields = function (obj) {
	return this.getMaskedOutFields(obj).length === 0;
};

/**
 * Given a dot-notation mapping from fields to values (only 1 level deep is checked),
 * ensure that all fields are in the (structured) mask.
 *
 * @method checkDottedFields
 * @param {Object} dottedObj - Mapping from dot-separated paths to values
 * @return {Boolean}
 */
ObjectMask.prototype.checkDottedFields = function (dottedObj) {
	var self = this;
	return _core.Object.keys(dottedObj).every(function (path) {
		return self.checkPath(path);
	});
};

/**
 * Creates a structured mask given a list of fields that should be included in the mask.
 *
 * @method createMaskFromFieldList
 * @static
 * @param {String[]} fields - Array of fields to include
 * @return {ObjectMask} - The created mask
 */
ObjectMask.createMaskFromFieldList = function (fields) {
	var ret = {};
	// We sort fields by length, long to short, to avoid more specific fields clobbering
	// less specific fields.
	fields = fields.slice(0).sort(function (a, b) {
		return b.length - a.length;
	});
	for (var i = 0; i < fields.length; i++) {
		objtools.setPath(ret, fields[i], true);
	}
	return new ObjectMask(ret);
};

/**
 * Returns a function that filters object fields based on a structured mask/whitelist.
 *
 * @method createFilterFunc
 * @static
 * @return {Function} - A function(obj) that is the equivalent of calling filterObject()
 * on obj
 */
ObjectMask.prototype.createFilterFunc = function () {
	var mask = this;
	return function (obj) {
		return mask.filterObject(obj);
	};
};
//# sourceMappingURL=data:application/json;base64,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QUMsR0FBRyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3ZDLFVBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztFQUN2QztBQUNELFFBQU8sSUFBSSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7Q0FDM0IsQ0FBQzs7Ozs7Ozs7OztBQVVGLFVBQVUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEdBQUcsWUFBVztBQUNsRCxLQUFJLElBQUksR0FBRyxJQUFJLENBQUM7QUFDaEIsUUFBTyxVQUFTLEdBQUcsRUFBRTtBQUNwQixTQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7RUFDOUIsQ0FBQztDQUNGLENBQUMiLCJmaWxlIjoibGliL29iamVjdC1tYXNrLmpzIiwic291cmNlc0NvbnRlbnQiOlsibGV0IG9ianRvb2xzID0gcmVxdWlyZSgnLi9pbmRleCcpO1xuXG4vKipcbiAqIFRoaXMgY2xhc3MgcmVwcmVzZW50cyBhIG1hc2ssIG9yIHdoaXRlbGlzdCwgb2YgZmllbGRzIG9uIGFuIG9iamVjdC4gIFN1Y2hcbiAqIGEgbWFzayBpcyBzdG9yZWQgaW4gYSBmb3JtYXQgdGhhdCBsb29rcyBsaWtlIHRoaXM6XG4gKlxuICogeyBmb286IHRydWUsIGJhcjogeyBiYXo6IHRydWUgfSB9XG4gKlxuICogVGhpcyBtYXNrIGFwcGxpZXMgdG8gdGhlIHByb3BlcnRpZXMgXCJmb29cIiBhbmQgXCJiYXIuYmF6XCIgb24gYW4gb2JqZWN0LlxuICogV2lsY2FyZHMgY2FuIGFsc28gYmUgdXNlZDpcbiAqXG4gKiB7IGZvbzogZmFsc2UsIGJhcjogZmFsc2UsIF86IHRydWUgfVxuICpcbiAqIFRoaXMgd2lsbCBhbGxvdyBhbGwgZmllbGRzIGJ1dCBmb28gYW5kIGJhci4gIFRoZSB1c2Ugb2YgYXJyYXlzIHdpdGhcbiAqIGEgc2luZ2xlIGVsZW1lbnQgaXMgZXF1aXZhbGVudCB0byB0aGUgdXNlIG9mIHdpbGRjYXJkcywgYXMgYXJyYXlzIGluXG4gKiB0aGUgbWFza2VkIG9iamVjdCBhcmUgdHJlYXRlZCBhcyBvYmplY3RzIHdpdGggbnVtZXJpYyBrZXlzLiAgVGhlc2VcbiAqIHR3byBtYXNrcyBhcmUgZXF1aXZhbGVudDpcbiAqXG4gKiB7IGZvbzogWyB7IGJhcjogdHJ1ZSwgYmF6OiB0cnVlIH0gXSB9XG4gKlxuICogeyBmb286IHsgXzogeyBiYXI6IHRydWUsIGJhejogdHJ1ZSB9IH0gfVxuICpcbiAqIEBjbGFzcyBPYmplY3RNYXNrXG4gKiBAY29uc3RydWN0b3JcbiAqIEBwYXJhbSB7T2JqZWN0fSBtYXNrIC0gVGhlIGRhdGEgZm9yIHRoZSBtYXNrXG4gKi9cbmZ1bmN0aW9uIE9iamVjdE1hc2sobWFzaykge1xuXHR0aGlzLm1hc2sgPSBtYXNrO1xufVxubW9kdWxlLmV4cG9ydHMgPSBPYmplY3RNYXNrO1xuXG4vKipcbiAqIFJldHVybnMgYSBjb3B5IG9mIHRoZSBnaXZlbiBvYmplY3QsIGJ1dCBvbmx5IGluY2x1ZGluZyB0aGUgZmllbGRzIGFsbG93ZWQgYnlcbiAqIHRoZSBtYXNrLiAgSWYgdGhlIG1hc2tlZE91dEhvb2sgZnVuY3Rpb24gaXMgcHJvdmlkZWQsIGl0IGlzIGNhbGxlZCBmb3JcbiAqIGVhY2ggZmllbGQgZGlzYWxsb3dlZCBieSB0aGUgbWFzayAoYXQgdGhlIGhpZ2hlc3QgbGV2ZWwgaXQgaXMgZGlzYWxsb3dlZCkuXG4gKlxuICogQG1ldGhvZCBmaWx0ZXJPYmplY3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogLSBPYmplY3QgdG8gZmlsdGVyXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbbWFza2VkT3V0SG9va10gLSBGdW5jdGlvbiB0byBjYWxsIGZvciBmaWVsZHMgZGlzYWxsb3dlZFxuICogYnkgdGhlIG1hc2tcbiAqIEBwYXJhbSB7U3RyaW5nfSBtYXNrZWRPdXRIb29rLnBhdGggLSBQYXRoIG9uIHRoZSBvYmplY3QgdGhhdCB3YXMgbWFza2VkIG91dFxuICogQHJldHVybiB7T2JqZWN0fSAtIFRoZSBvYmplY3QgYWZ0ZXIgcmVtb3ZpbmcgbWFza2VkIG91dCBmaWVsZHMuICBOb3RlIHRoYXRcbiAqIHRoZSByZXR1cm5lZCBvYmplY3QgbWF5IHN0aWxsIGNvbnRhaW4gcmVmZXJlbmNlcyB0byB0aGUgb3JpZ2luYWwgb2JqZWN0LlxuICogRmllbGRzIHRoYXQgYXJlIG5vdCBtYXNrZWQgb3V0IGFyZSBjb3BpZWQgYnkgcmVmZXJlbmNlLlxuICovXG5PYmplY3RNYXNrLnByb3RvdHlwZS5maWx0ZXJPYmplY3QgPSBmdW5jdGlvbihvYmosIG1hc2tlZE91dEhvb2spIHtcblx0bGV0IG1hc2sgPSB0aGlzLm1hc2s7XG5cdGZ1bmN0aW9uIGZpbHRlcihvYmosIG1hc2ssIHBhdGgpIHtcblx0XHRpZiAobWFzayA9PT0gdHJ1ZSkgcmV0dXJuIG9iajtcblx0XHRpZiAoIW1hc2sgfHwgb2JqdG9vbHMuaXNTY2FsYXIob2JqKSkge1xuXHRcdFx0aWYgKG1hc2tlZE91dEhvb2spIG1hc2tlZE91dEhvb2socGF0aCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoQXJyYXkuaXNBcnJheShtYXNrKSkge1xuXHRcdFx0bWFzayA9IHsgXzogbWFza1swXSB8fCBmYWxzZSB9O1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIG1hc2sgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRsZXQgcmVzdWx0SXNBcnJheSA9IEFycmF5LmlzQXJyYXkob2JqKTtcblx0XHRcdGxldCByZXN1bHRPYmogPSByZXN1bHRJc0FycmF5ID8gW10gOiB7fTtcblx0XHRcdGxldCBtYXNrVmFsLCByZXN1bHRWYWw7XG5cdFx0XHRmb3IgKGxldCBrZXkgaW4gb2JqKSB7XG5cdFx0XHRcdG1hc2tWYWwgPSAobWFza1trZXldID09PSB1bmRlZmluZWQpID8gbWFzay5fIDogbWFza1trZXldO1xuXHRcdFx0XHRyZXN1bHRWYWwgPSBmaWx0ZXIob2JqW2tleV0sIG1hc2tWYWwgfHwgZmFsc2UsIHBhdGggPyAocGF0aCArICcuJyArIGtleSkgOiBrZXkpO1xuXHRcdFx0XHRpZiAocmVzdWx0VmFsICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRpZiAocmVzdWx0SXNBcnJheSkgcmVzdWx0T2JqLnB1c2gocmVzdWx0VmFsKTtcblx0XHRcdFx0XHRlbHNlIHJlc3VsdE9ialtrZXldID0gcmVzdWx0VmFsO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0T2JqO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAobWFza2VkT3V0SG9vaykgbWFza2VkT3V0SG9vayhwYXRoKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBmaWx0ZXIob2JqLCBtYXNrLCAnJyk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBzdWJzZWN0aW9uIG9mIGEgbWFzayBnaXZlbiBhIGRvdC1zZXBhcmF0ZWQgcGF0aCB0byB0aGUgc3Vic2VjdGlvbi5cbiAqXG4gKiBAbWV0aG9kIGdldFN1Yk1hc2tcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIC0gRG90LXNlcGFyYXRlZCBwYXRoIHRvIHN1Ym1hc2sgdG8gZmV0Y2hcbiAqIEByZXR1cm4ge09iamVjdE1hc2t9IC0gTWFzayBjb21wb25lbnQgY29ycmVzcG9uZGluZyB0byB0aGUgcGF0aFxuICovXG5PYmplY3RNYXNrLnByb3RvdHlwZS5nZXRTdWJNYXNrID0gZnVuY3Rpb24ocGF0aCkge1xuXHRsZXQgbWFzayA9IHRoaXMubWFzaztcblx0bGV0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuXHRsZXQgY3VyID0gbWFzaztcblx0Zm9yIChsZXQgcGFydElkeCA9IDA7IHBhcnRJZHggPCBwYXJ0cy5sZW5ndGg7IHBhcnRJZHgrKykge1xuXHRcdGlmIChjdXIgPT09IHRydWUpIHJldHVybiB0cnVlO1xuXHRcdGlmIChvYmp0b29scy5pc1NjYWxhcihjdXIpKSByZXR1cm4gZmFsc2U7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoY3VyKSkgY3VyID0geyBfOiBjdXJbMF0gfHwgZmFsc2UgfTtcblx0XHRsZXQgcGFydCA9IHBhcnRzW3BhcnRJZHhdO1xuXHRcdGN1ciA9IChjdXJbcGFydF0gPT09IHVuZGVmaW5lZCkgPyBjdXIuXyA6IGN1cltwYXJ0XTtcblx0fVxuXHRyZXR1cm4gbmV3IE9iamVjdE1hc2soY3VyIHx8IGZhbHNlKTtcbn07XG5cbi8qKlxuICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBwYXRoIGlzIGFsbG93ZWQgYnkgdGhlIG1hc2suICBmYWxzZSBvdGhlcndpc2UuXG4gKlxuICogQG1ldGhvZCBjaGVja01hc2tQYXRoXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aCAtIERvdC1zZXBhcmF0ZWQgcGF0aFxuICogQHJldHVybiB7Qm9vbGVhbn0gLSBXaGV0aGVyIG9yIG5vdCB0aGUgZ2l2ZW4gcGF0aCBpcyBhbGxvd2VkXG4gKi9cbk9iamVjdE1hc2sucHJvdG90eXBlLmNoZWNrUGF0aCA9IGZ1bmN0aW9uKHBhdGgpIHtcblx0cmV0dXJuIHRoaXMuZ2V0U3ViTWFzayhwYXRoKS5tYXNrID09PSB0cnVlO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBpbnRlcm5hbCBvYmplY3QgdGhhdCByZXByZXNlbnRzIHRoaXMgbWFzay5cbiAqXG4gKiBAbWV0aG9kIHRvT2JqZWN0XG4gKiBAcmV0dXJuIHtPYmplY3R9IC0gT2JqZWN0IHJlcHJlc2VudGF0aW9uIG9mIHRoaXMgbWFza1xuICovXG5PYmplY3RNYXNrLnByb3RvdHlwZS50b09iamVjdCA9IGZ1bmN0aW9uKCkge1xuXHRyZXR1cm4gdGhpcy5tYXNrO1xufTtcblxuLyoqXG4gKiBDb21iaW5lcyB0d28gb3IgbW9yZSBtYXNrcyBzdWNoIHRoYXQgdGhlIHJlc3VsdCBtYXNrIG1hdGNoZXMgZmllbGRzIG1hdGNoZWQgYnlcbiAqIGFueSBvZiB0aGUgY29tYmluZWQgbWFza3MuXG4gKlxuICogQG1ldGhvZCBhZGRNYXNrc1xuICogQHN0YXRpY1xuICogQHBhcmFtIHtPYmplY3RNYXNrfE9iamVjdH0gbWFzazFcbiAqIEBwYXJhbSB7T2JqZWN0TWFza3xPYmplY3R9IG1hc2syLi4uXG4gKiBAcmV0dXJuIHtPYmplY3RNYXNrfSAtIFRoZSByZXN1bHQgb2YgYWRkaW5nIHRvZ2V0aGVyIHRoZSBjb21wb25lbnQgbWFza3NcbiAqL1xuT2JqZWN0TWFzay5hZGRNYXNrcyA9IGZ1bmN0aW9uKCkge1xuXHRsZXQgcmVzdWx0TWFzayA9IGZhbHNlO1xuXG5cdC8vIEFkZHMgYSBzaW5nbGUgbWFzayAoZnJvbU1hc2spIGludG8gdGhlIHJlc3VsdE1hc2sgbWFzayBpbi1wbGFjZS4gIHRvTWFzayBzaG91bGQgYmUgYW4gb2JqZWN0LlxuXHQvLyBJZiB0aGUgcmVzdWx0aW5nIG1hc2sgaXMgYSBib29sZWFuIHRydWUsIHRoaXMgZnVuY3Rpb24gcmV0dXJucyB0cnVlLiAgT3RoZXJ3aXNlLCBpdCByZXR1cm5zIHRvTWFzay5cblx0ZnVuY3Rpb24gYWRkTWFzayhyZXN1bHRNYXNrLCBuZXdNYXNrKSB7XG5cdFx0bGV0IGtleTtcblxuXHRcdGlmIChyZXN1bHRNYXNrID09PSB0cnVlKSByZXR1cm4gdHJ1ZTtcblx0XHRpZiAobmV3TWFzayA9PT0gdHJ1ZSkge1xuXHRcdFx0cmVzdWx0TWFzayA9IHRydWU7XG5cdFx0XHRyZXR1cm4gcmVzdWx0TWFzaztcblx0XHR9XG5cdFx0aWYgKG9ianRvb2xzLmlzU2NhbGFyKG5ld01hc2spKSByZXR1cm4gcmVzdWx0TWFzaztcblx0XHRpZiAob2JqdG9vbHMuaXNTY2FsYXIocmVzdWx0TWFzaykpIHtcblx0XHRcdHJlc3VsdE1hc2sgPSBvYmp0b29scy5kZWVwQ29weShuZXdNYXNrKTtcblx0XHRcdHJldHVybiByZXN1bHRNYXNrO1xuXHRcdH1cblxuXHRcdGlmIChBcnJheS5pc0FycmF5KHJlc3VsdE1hc2spKSB7XG5cdFx0XHRyZXN1bHRNYXNrID0geyBfOiByZXN1bHRNYXNrWzBdIHx8IGZhbHNlIH07XG5cdFx0fVxuXHRcdGlmIChBcnJheS5pc0FycmF5KG5ld01hc2spKSB7XG5cdFx0XHRuZXdNYXNrID0geyBfOiBuZXdNYXNrWzBdIHx8IGZhbHNlIH07XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlcmUgYXJlIGtleXMgdGhhdCBleGlzdCBpbiByZXN1bHQgYnV0IG5vdCBpbiB0aGUgbmV3TWFzayxcblx0XHQvLyBhbmQgdGhlIHJlc3VsdCBtYXNrIGhhcyBhIF8ga2V5ICh3aWxkY2FyZCksIGNvbWJpbmVcblx0XHQvLyB0aGUgd2lsZGNhcmQgbWFzayB3aXRoIHRoZSBuZXcgbWFzaywgYmVjYXVzZSBpbiB0aGUgZXhpc3Rpbmdcblx0XHQvLyByZXN1bHQgbWFzaywgdGhhdCBrZXkgaGFzIHRoZSB3aWxkY2FyZCBwZXJtaXNzaW9uc1xuXHRcdGlmIChuZXdNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Zm9yIChrZXkgaW4gcmVzdWx0TWFzaykge1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnXycpIGNvbnRpbnVlO1xuXHRcdFx0XHRpZiAobmV3TWFza1trZXldID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXN1bHRNYXNrW2tleV0gPSBhZGRNYXNrKHJlc3VsdE1hc2tba2V5XSwgbmV3TWFzay5fKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHNhbWUgaGVyZSAuLi4gYWxzbywgY29weSBvdmVyIG9yIG1lcmdlIGZpZWxkc1xuXHRcdGZvciAoa2V5IGluIG5ld01hc2spIHtcblx0XHRcdGlmIChrZXkgPT09ICdfJykgY29udGludWU7XG5cdFx0XHRpZiAocmVzdWx0TWFza1trZXldICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gYWRkTWFzayhyZXN1bHRNYXNrW2tleV0sIG5ld01hc2tba2V5XSk7XG5cdFx0XHR9IGVsc2UgaWYgKHJlc3VsdE1hc2suXyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGFkZE1hc2sob2JqdG9vbHMuZGVlcENvcHkobmV3TWFza1trZXldKSwgcmVzdWx0TWFzay5fKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IG9ianRvb2xzLmRlZXBDb3B5KG5ld01hc2tba2V5XSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIGZpbGwgaW4gdGhlIF8ga2V5IHRoYXQgd2Ugc2tpcHBlZCBlYXJsaWVyXG5cdFx0aWYgKG5ld01hc2suXyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpZiAocmVzdWx0TWFzay5fICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmVzdWx0TWFzay5fID0gYWRkTWFzayhyZXN1bHRNYXNrLl8sIG5ld01hc2suXyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHRNYXNrLl8gPSBvYmp0b29scy5kZWVwQ29weShuZXdNYXNrLl8pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIElmIHRoZXJlIGlzIGEgd2lsZGNhcmQsIHJlbW92ZSBhbnkga2V5cyB0aGF0IGFyZSBzZXQgdG8gdGhlIHNhbWUgdGhpbmcgYXMgdGhlIHdpbGRjYXJkXG5cdFx0Ly8gVGhpcyBpc24ndCBzdHJpY3RseSBuZWNlc3NhcnksIGJ1dCByZW1vdmVzIHJlZHVuZGFudCBkYXRhXG5cdFx0aWYgKHJlc3VsdE1hc2suXyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRmb3IgKGtleSBpbiByZXN1bHRNYXNrKSB7XG5cdFx0XHRcdGlmIChrZXkgIT09ICdfJyAmJiBvYmp0b29scy5kZWVwRXF1YWxzKHJlc3VsdE1hc2tba2V5XSwgcmVzdWx0TWFzay5fKSkge1xuXHRcdFx0XHRcdGRlbGV0ZSByZXN1bHRNYXNrW2tleV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0TWFzayB8fCBmYWxzZTtcblx0fVxuXG5cdGxldCBjdXJBcmc7XG5cdGZvciAobGV0IGFyZ0lkeCA9IDA7IGFyZ0lkeCA8IGFyZ3VtZW50cy5sZW5ndGg7IGFyZ0lkeCsrKSB7XG5cdFx0Y3VyQXJnID0gYXJndW1lbnRzW2FyZ0lkeF07XG5cdFx0aWYgKGN1ckFyZyBpbnN0YW5jZW9mIE9iamVjdE1hc2spIHtcblx0XHRcdGN1ckFyZyA9IGN1ckFyZy50b09iamVjdCgpO1xuXHRcdH1cblx0XHRyZXN1bHRNYXNrID0gYWRkTWFzayhyZXN1bHRNYXNrLCBjdXJBcmcpO1xuXHRcdGlmIChyZXN1bHRNYXNrID09PSB0cnVlKSByZXR1cm4gdHJ1ZTtcblx0fVxuXHRyZXR1cm4gbmV3IE9iamVjdE1hc2socmVzdWx0TWFzayB8fCBmYWxzZSk7XG59O1xuXG4vKipcbiAqIEFkZHMgYSBzZXQgb2YgbWFza3MgdG9nZXRoZXIsIGJ1dCB1c2luZyBhIGxvZ2ljYWwgQU5EIGluc3RlYWQgb2YgYSBsb2dpY2FsIE9SIChhcyBpbiBhZGRNYXNrcykuXG4gKiBJRSwgYSBmaWVsZCBtdXN0IGJlIGFsbG93ZWQgaW4gYWxsIGdpdmVuIG1hc2tzIHRvIGJlIGluIHRoZSByZXN1bHQgbWFzay5cbiAqXG4gKiBAbWV0aG9kIGFuZE1hc2tzXG4gKiBAc3RhdGljXG4gKiBAcGFyYW0ge09iamVjdE1hc2t8T2JqZWN0fSBtYXNrMVxuICogQHBhcmFtIHtPYmplY3RNYXNrfE9iamVjdH0gbWFzazIuLi5cbiAqIEByZXR1cm4ge09iamVjdE1hc2t9IC0gVGhlIHJlc3VsdCBvZiBBTkRpbmcgdG9nZXRoZXIgdGhlIGNvbXBvbmVudCBtYXNrc1xuICovXG5PYmplY3RNYXNrLmFuZE1hc2tzID0gZnVuY3Rpb24oKSB7XG5cdGxldCByZXN1bHRNYXNrID0gdHJ1ZTtcblxuXHRmdW5jdGlvbiBhbmRNYXNrKHJlc3VsdE1hc2ssIG5ld01hc2spIHtcblx0XHRsZXQga2V5O1xuXG5cdFx0Ly8gRGVnZW5lcmF0ZSBjYXNlc1xuXHRcdGlmIChyZXN1bHRNYXNrID09PSB0cnVlKSByZXR1cm4gb2JqdG9vbHMuZGVlcENvcHkobmV3TWFzayk7XG5cdFx0aWYgKG5ld01hc2sgPT09IHRydWUpIHJldHVybiByZXN1bHRNYXNrO1xuXHRcdGlmIChvYmp0b29scy5pc1NjYWxhcihyZXN1bHRNYXNrKSB8fCBvYmp0b29scy5pc1NjYWxhcihuZXdNYXNrKSkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0Ly8gUmVzb2x2ZSBhcnJheXNcblx0XHRpZiAoQXJyYXkuaXNBcnJheShyZXN1bHRNYXNrKSkge1xuXHRcdFx0cmVzdWx0TWFzayA9IHsgXzogcmVzdWx0TWFza1swXSB8fCBmYWxzZSB9O1xuXHRcdH1cblx0XHRpZiAoQXJyYXkuaXNBcnJheShuZXdNYXNrKSkge1xuXHRcdFx0bmV3TWFzayA9IHsgXzogbmV3TWFza1swXSB8fCBmYWxzZSB9O1xuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSBrZXlzIHRoYXQgZXhpc3QgaW4gYm90aCBtYXNrcywgZXhjZXB0aW5nIF9cblx0XHRmb3IgKGtleSBpbiBuZXdNYXNrKSB7XG5cdFx0XHRpZiAoa2V5ID09PSAnXycpIGNvbnRpbnVlO1xuXHRcdFx0aWYgKHJlc3VsdE1hc2tba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGFuZE1hc2socmVzdWx0TWFza1trZXldLCBuZXdNYXNrW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEhhbmRsZSBrZXlzIHRoYXQgZXhpc3QgaW4gcmVzdWx0TWFzayBidXQgbm90IGluIG5ld01hc2tcblx0XHRmb3IgKGtleSBpbiByZXN1bHRNYXNrKSB7XG5cdFx0XHRpZiAoa2V5ID09PSAnXycpIGNvbnRpbnVlO1xuXHRcdFx0aWYgKG5ld01hc2tba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGlmIChuZXdNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGFuZE1hc2socmVzdWx0TWFza1trZXldLCBuZXdNYXNrLl8pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIGtleXMgdGhhdCBleGlzdCBpbiBuZXdNYXNrIGJ1dCBub3QgcmVzdWx0TWFza1xuXHRcdGZvciAoa2V5IGluIG5ld01hc2spIHtcblx0XHRcdGlmIChrZXkgPT09ICdfJykgY29udGludWU7XG5cdFx0XHRpZiAocmVzdWx0TWFza1trZXldID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0aWYgKHJlc3VsdE1hc2suXyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gYW5kTWFzayhvYmp0b29scy5kZWVwQ29weShuZXdNYXNrW2tleV0pLCByZXN1bHRNYXNrLl8pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGFuZGxlIF8gKHdpbGRjYXJkIGZpZWxkcylcblx0XHRpZiAobmV3TWFzay5fICE9PSB1bmRlZmluZWQgJiYgcmVzdWx0TWFzay5fICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHJlc3VsdE1hc2suXyA9IGFuZE1hc2socmVzdWx0TWFzay5fLCBuZXdNYXNrLl8pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkZWxldGUgcmVzdWx0TWFzay5fO1xuXHRcdH1cblxuXHRcdC8vIFRvIGNvbmRlbnNlIHNvbWUgY2FzZXMsIHJlbW92ZSB1bm5lY2Vzc2FyeSBmYWxzeSB2YWx1ZXNcblx0XHRpZiAoIXJlc3VsdE1hc2suXykge1xuXHRcdFx0ZGVsZXRlIHJlc3VsdE1hc2suXztcblx0XHRcdC8vIFNpbmNlIGFsbCB2YWx1ZXMgd2lsbCBkZWZhdWx0IHRvIGZhbHNlLCB3ZSBjYW4gcmVtb3ZlIGFueSBmYWxzeSB2YWx1ZXNcblx0XHRcdGZvciAoa2V5IGluIHJlc3VsdE1hc2spIHtcblx0XHRcdFx0aWYgKCFyZXN1bHRNYXNrW2tleV0pIHtcblx0XHRcdFx0XHRkZWxldGUgcmVzdWx0TWFza1trZXldO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlcmUgYXJlIG5vIGtleXMgbGVmdCBpbiByZXN1bHRNYXNrLCBjb25kZW5zZSB0byBmYWxzZVxuXHRcdGlmICghT2JqZWN0LmtleXMocmVzdWx0TWFzaykubGVuZ3RoKSByZXR1cm4gZmFsc2U7XG5cblx0XHRyZXR1cm4gcmVzdWx0TWFzaztcblx0fVxuXG5cdGxldCBjdXJBcmc7XG5cdGZvciAobGV0IGFyZ0lkeCA9IDA7IGFyZ0lkeCA8IGFyZ3VtZW50cy5sZW5ndGg7IGFyZ0lkeCsrKSB7XG5cdFx0Y3VyQXJnID0gYXJndW1lbnRzW2FyZ0lkeF07XG5cdFx0aWYgKGN1ckFyZyBpbnN0YW5jZW9mIE9iamVjdE1hc2spIHtcblx0XHRcdGN1ckFyZyA9IGN1ckFyZy50b09iamVjdCgpO1xuXHRcdH1cblx0XHRyZXN1bHRNYXNrID0gYW5kTWFzayhyZXN1bHRNYXNrLCBjdXJBcmcpO1xuXHRcdGlmIChyZXN1bHRNYXNrID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiBuZXcgT2JqZWN0TWFzayhyZXN1bHRNYXNrIHx8IGZhbHNlKTtcbn07XG5cblxuLyoqXG4gKiBDaGVjayBpZiBhIG1hc2sgaXMgdmFsaWQgaW4gc3RyaWN0IGZvcm0gKGllLCBpdCBvbmx5IGNvbnRhaW5zIG9iamVjdHMgYW5kIGJvb2xlYW5zKVxuICpcbiAqIEBtZXRob2QgdmFsaWRhdGVcbiAqIEByZXR1cm4ge0Jvb2xlYW59IC0gV2hldGhlciBvciBub3QgdGhlIG1hc2sgaXMgc3RyaWN0bHkgdmFsaWRcbiAqL1xuT2JqZWN0TWFzay5wcm90b3R5cGUudmFsaWRhdGUgPSBmdW5jdGlvbigpIHtcblx0ZnVuY3Rpb24gdmFsV2hpdGVsaXN0KHdoaXRlbGlzdCkge1xuXHRcdGlmICh3aGl0ZWxpc3QgIT09IHRydWUgJiYgd2hpdGVsaXN0ICE9PSBmYWxzZSAmJiBvYmp0b29scy5pc1NjYWxhcih3aGl0ZWxpc3QpKSByZXR1cm4gZmFsc2U7XG5cdFx0aWYgKHR5cGVvZiB3aGl0ZWxpc3QgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRmb3IgKGxldCBrZXkgaW4gd2hpdGVsaXN0KSB7XG5cdFx0XHRcdGlmICghdmFsV2hpdGVsaXN0KHdoaXRlbGlzdFtrZXldKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRyZXR1cm4gdmFsV2hpdGVsaXN0KHRoaXMubWFzayk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYW4gYXJyYXkgb2YgZmllbGRzIGluIHRoZSBnaXZlbiBvYmplY3Qgd2hpY2ggYXJlIHJlc3RyaWN0ZWQgYnkgdGhlIGdpdmVuIG1hc2tcbiAqXG4gKiBAbWV0aG9kIGdldE1hc2tlZE91dEZpZWxkc1xuICogQHBhcmFtIHtPYmplY3R9IG9iaiAtIFRoZSBvYmplY3QgdG8gY2hlY2sgYWdhaW5zdFxuICogQHJldHVybiB7U3RyaW5nW119IC0gUGF0aHMgdG8gZmllbGRzIHRoYXQgYXJlIHJlc3RyaWN0ZWQgYnkgdGhlIG1hc2tcbiAqL1xuT2JqZWN0TWFzay5wcm90b3R5cGUuZ2V0TWFza2VkT3V0RmllbGRzID0gZnVuY3Rpb24ob2JqKSB7XG5cdGxldCBtYXNrZWRPdXQgPSBbXTtcblx0dGhpcy5maWx0ZXJPYmplY3Qob2JqLCBmdW5jdGlvbihwYXRoKSB7XG5cdFx0bWFza2VkT3V0LnB1c2gocGF0aCk7XG5cdH0pO1xuXHRyZXR1cm4gbWFza2VkT3V0O1xufTtcblxuLyoqXG4gKiBHaXZlbiBhIGRvdC1ub3RhdGlvbiBtYXBwaW5nIGZyb20gZmllbGRzIHRvIHZhbHVlcywgcmVtb3ZlIGFsbCBmaWVsZHMgdGhhdCBhcmUgbm90XG4gKiBhbGxvd2VkIGJ5IHRoZSBtYXNrLlxuICpcbiAqIEBtZXRob2QgZmlsdGVyRG90dGVkT2JqZWN0XG4gKiBAcGFyYW0ge09iamVjdH0gZG90dGVkT2JqIC0gTWFwIGZyb20gZG90dGVkIHBhdGhzIHRvIHZhbHVlcywgc3VjaCBhcyB7IFwiZm9vLmJhclwiOiBcImJhelwiIH1cbiAqIEBwYXJhbSB7RnVuY3Rpb259IFttYXNrZWRPdXRIb29rXSAtIEZ1bmN0aW9uIHRvIGNhbGwgZm9yIHJlbW92ZWQgZmllbGRzXG4gKiBAcGFyYW0ge1N0cmluZ30gbWFza2VkT3V0SG9vay5wYXRoIC0gUGF0aCBvZiB0aGUgbWFza2VkIG91dCBmaWVsZFxuICogQHJldHVybiB7T2JqZWN0fSAtIFRoZSByZXN1bHRcbiAqL1xuT2JqZWN0TWFzay5wcm90b3R5cGUuZmlsdGVyRG90dGVkT2JqZWN0ID0gZnVuY3Rpb24oZG90dGVkT2JqLCBtYXNrZWRPdXRIb29rKSB7XG5cdGxldCByZXN1bHRPYmogPSB7fTtcblx0Zm9yIChsZXQga2V5IGluIGRvdHRlZE9iaikge1xuXHRcdGlmICghdGhpcy5jaGVja1BhdGgoa2V5KSkge1xuXHRcdFx0aWYgKG1hc2tlZE91dEhvb2spIHtcblx0XHRcdFx0bWFza2VkT3V0SG9vayhrZXkpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHRPYmpba2V5XSA9IGRvdHRlZE9ialtrZXldO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzdWx0T2JqO1xufTtcblxuLyoqXG4gKiBSZXR1cm5zIGFuIGFycmF5IG9mIGZpZWxkcyBpbiB0aGUgZ2l2ZW4gb2JqZWN0IHdoaWNoIGFyZSByZXN0cmljdGVkIGJ5IHRoZSBnaXZlbiBtYXNrLiAgVGhlXG4gKiBvYmplY3QgaXMgaW4gZG90dGVkIG5vdGF0aW9uIGFzIGluIGZpbHRlckRvdHRlZE9iamVjdCgpXG4gKlxuICogQG1ldGhvZCBnZXREb3R0ZWRNYXNrZWRPdXRGaWVsZHNcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogLSBUaGUgb2JqZWN0IHRvIGNoZWNrIGFnYWluc3RcbiAqIEByZXR1cm4ge1N0cmluZ1tdfSAtIFBhdGhzIHRvIGZpZWxkcyB0aGF0IGFyZSByZXN0cmljdGVkIGJ5IHRoZSBtYXNrXG4gKi9cbk9iamVjdE1hc2sucHJvdG90eXBlLmdldERvdHRlZE1hc2tlZE91dEZpZWxkcyA9IGZ1bmN0aW9uKG9iaikge1xuXHRsZXQgbWFza2VkT3V0ID0gW107XG5cdHRoaXMuZmlsdGVyRG90dGVkT2JqZWN0KG9iaiwgZnVuY3Rpb24ocGF0aCkge1xuXHRcdG1hc2tlZE91dC5wdXNoKHBhdGgpO1xuXHR9KTtcblx0cmV0dXJuIG1hc2tlZE91dDtcbn07XG5cbi8qKlxuICogR2l2ZW4gYSBzdHJ1Y3R1cmVkIGRvY3VtZW50LCBlbnN1cmVzIHRoYXRcbiAqIGFsbCBmaWVsZHMgYXJlIGFsbG93ZWQgYnkgdGhlIGdpdmVuIG1hc2suICBSZXR1cm5zIHRydWUgb3IgZmFsc2UuXG4gKlxuICogQG1ldGhvZCBjaGVja0ZpZWxkc1xuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuT2JqZWN0TWFzay5wcm90b3R5cGUuY2hlY2tGaWVsZHMgPSBmdW5jdGlvbihvYmopIHtcblx0cmV0dXJuIHRoaXMuZ2V0TWFza2VkT3V0RmllbGRzKG9iaikubGVuZ3RoID09PSAwO1xufTtcblxuLyoqXG4gKiBHaXZlbiBhIGRvdC1ub3RhdGlvbiBtYXBwaW5nIGZyb20gZmllbGRzIHRvIHZhbHVlcyAob25seSAxIGxldmVsIGRlZXAgaXMgY2hlY2tlZCksXG4gKiBlbnN1cmUgdGhhdCBhbGwgZmllbGRzIGFyZSBpbiB0aGUgKHN0cnVjdHVyZWQpIG1hc2suXG4gKlxuICogQG1ldGhvZCBjaGVja0RvdHRlZEZpZWxkc1xuICogQHBhcmFtIHtPYmplY3R9IGRvdHRlZE9iaiAtIE1hcHBpbmcgZnJvbSBkb3Qtc2VwYXJhdGVkIHBhdGhzIHRvIHZhbHVlc1xuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuT2JqZWN0TWFzay5wcm90b3R5cGUuY2hlY2tEb3R0ZWRGaWVsZHMgPSBmdW5jdGlvbihkb3R0ZWRPYmopIHtcblx0bGV0IHNlbGYgPSB0aGlzO1xuXHRyZXR1cm4gT2JqZWN0LmtleXMoZG90dGVkT2JqKS5ldmVyeShmdW5jdGlvbihwYXRoKSB7XG5cdFx0cmV0dXJuIHNlbGYuY2hlY2tQYXRoKHBhdGgpO1xuXHR9KTtcbn07XG5cbi8qKlxuICogQ3JlYXRlcyBhIHN0cnVjdHVyZWQgbWFzayBnaXZlbiBhIGxpc3Qgb2YgZmllbGRzIHRoYXQgc2hvdWxkIGJlIGluY2x1ZGVkIGluIHRoZSBtYXNrLlxuICpcbiAqIEBtZXRob2QgY3JlYXRlTWFza0Zyb21GaWVsZExpc3RcbiAqIEBzdGF0aWNcbiAqIEBwYXJhbSB7U3RyaW5nW119IGZpZWxkcyAtIEFycmF5IG9mIGZpZWxkcyB0byBpbmNsdWRlXG4gKiBAcmV0dXJuIHtPYmplY3RNYXNrfSAtIFRoZSBjcmVhdGVkIG1hc2tcbiAqL1xuT2JqZWN0TWFzay5jcmVhdGVNYXNrRnJvbUZpZWxkTGlzdCA9IGZ1bmN0aW9uKGZpZWxkcykge1xuXHRsZXQgcmV0ID0ge307XG5cdC8vIFdlIHNvcnQgZmllbGRzIGJ5IGxlbmd0aCwgbG9uZyB0byBzaG9ydCwgdG8gYXZvaWQgbW9yZSBzcGVjaWZpYyBmaWVsZHMgY2xvYmJlcmluZ1xuXHQvLyBsZXNzIHNwZWNpZmljIGZpZWxkcy5cblx0ZmllbGRzID0gZmllbGRzLnNsaWNlKDApLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuXHRcdHJldHVybiBiLmxlbmd0aCAtIGEubGVuZ3RoO1xuXHR9KTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcblx0XHRvYmp0b29scy5zZXRQYXRoKHJldCwgZmllbGRzW2ldLCB0cnVlKTtcblx0fVxuXHRyZXR1cm4gbmV3IE9iamVjdE1hc2socmV0KTtcbn07XG5cbi8qKlxuICogUmV0dXJucyBhIGZ1bmN0aW9uIHRoYXQgZmlsdGVycyBvYmplY3QgZmllbGRzIGJhc2VkIG9uIGEgc3RydWN0dXJlZCBtYXNrL3doaXRlbGlzdC5cbiAqXG4gKiBAbWV0aG9kIGNyZWF0ZUZpbHRlckZ1bmNcbiAqIEBzdGF0aWNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSAtIEEgZnVuY3Rpb24ob2JqKSB0aGF0IGlzIHRoZSBlcXVpdmFsZW50IG9mIGNhbGxpbmcgZmlsdGVyT2JqZWN0KClcbiAqIG9uIG9ialxuICovXG5PYmplY3RNYXNrLnByb3RvdHlwZS5jcmVhdGVGaWx0ZXJGdW5jID0gZnVuY3Rpb24oKSB7XG5cdGxldCBtYXNrID0gdGhpcztcblx0cmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuXHRcdHJldHVybiBtYXNrLmZpbHRlck9iamVjdChvYmopO1xuXHR9O1xufTtcbiJdfQ==