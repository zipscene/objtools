"use strict";

var _babelHelpers = require("babel-runtime/helpers").default;

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

var ObjectMask = (function () {
	function ObjectMask(mask) {
		_babelHelpers.classCallCheck(this, ObjectMask);

		this.mask = mask;
	}

	_babelHelpers.prototypeProperties(ObjectMask, {
		addMasks: {

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

			value: function addMasks() {
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
			},
			writable: true,
			configurable: true
		},
		andMasks: {

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

			value: function andMasks() {
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
			},
			writable: true,
			configurable: true
		},
		createMaskFromFieldList: {

			/**
    * Creates a structured mask given a list of fields that should be included in the mask.
    *
    * @method createMaskFromFieldList
    * @static
    * @param {String[]} fields - Array of fields to include
    * @return {ObjectMask} - The created mask
    */

			value: function createMaskFromFieldList(fields) {
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
			},
			writable: true,
			configurable: true
		}
	}, {
		filterObject: {

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

			value: function filterObject(obj, maskedOutHook) {
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
			},
			writable: true,
			configurable: true
		},
		getSubMask: {

			/**
    * Returns a subsection of a mask given a dot-separated path to the subsection.
    *
    * @method getSubMask
    * @param {String} path - Dot-separated path to submask to fetch
    * @return {ObjectMask} - Mask component corresponding to the path
    */

			value: function getSubMask(path) {
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
			},
			writable: true,
			configurable: true
		},
		checkPath: {

			/**
    * Returns true if the given path is allowed by the mask.  false otherwise.
    *
    * @method checkMaskPath
    * @param {String} path - Dot-separated path
    * @return {Boolean} - Whether or not the given path is allowed
    */

			value: function checkPath(path) {
				return this.getSubMask(path).mask === true;
			},
			writable: true,
			configurable: true
		},
		toObject: {

			/**
    * Returns the internal object that represents this mask.
    *
    * @method toObject
    * @return {Object} - Object representation of this mask
    */

			value: function toObject() {
				return this.mask;
			},
			writable: true,
			configurable: true
		},
		validate: {

			/**
    * Check if a mask is valid in strict form (ie, it only contains objects and booleans)
    *
    * @method validate
    * @return {Boolean} - Whether or not the mask is strictly valid
    */

			value: function validate() {
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
			},
			writable: true,
			configurable: true
		},
		getMaskedOutFields: {

			/**
    * Returns an array of fields in the given object which are restricted by the given mask
    *
    * @method getMaskedOutFields
    * @param {Object} obj - The object to check against
    * @return {String[]} - Paths to fields that are restricted by the mask
    */

			value: function getMaskedOutFields(obj) {
				var maskedOut = [];
				this.filterObject(obj, function (path) {
					maskedOut.push(path);
				});
				return maskedOut;
			},
			writable: true,
			configurable: true
		},
		filterDottedObject: {

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

			value: function filterDottedObject(dottedObj, maskedOutHook) {
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
			},
			writable: true,
			configurable: true
		},
		getDottedMaskedOutFields: {

			/**
    * Returns an array of fields in the given object which are restricted by the given mask.  The
    * object is in dotted notation as in filterDottedObject()
    *
    * @method getDottedMaskedOutFields
    * @param {Object} obj - The object to check against
    * @return {String[]} - Paths to fields that are restricted by the mask
    */

			value: function getDottedMaskedOutFields(obj) {
				var maskedOut = [];
				this.filterDottedObject(obj, function (path) {
					maskedOut.push(path);
				});
				return maskedOut;
			},
			writable: true,
			configurable: true
		},
		checkFields: {

			/**
    * Given a structured document, ensures that
    * all fields are allowed by the given mask.  Returns true or false.
    *
    * @method checkFields
    * @param {Object} obj
    * @return {Boolean}
    */

			value: function checkFields(obj) {
				return this.getMaskedOutFields(obj).length === 0;
			},
			writable: true,
			configurable: true
		},
		checkDottedFields: {

			/**
    * Given a dot-notation mapping from fields to values (only 1 level deep is checked),
    * ensure that all fields are in the (structured) mask.
    *
    * @method checkDottedFields
    * @param {Object} dottedObj - Mapping from dot-separated paths to values
    * @return {Boolean}
    */

			value: function checkDottedFields(dottedObj) {
				var self = this;
				return _core.Object.keys(dottedObj).every(function (path) {
					return self.checkPath(path);
				});
			},
			writable: true,
			configurable: true
		},
		createFilterFunc: {

			/**
    * Returns a function that filters object fields based on a structured mask/whitelist.
    *
    * @method createFilterFunc
    * @static
    * @return {Function} - A function(obj) that is the equivalent of calling filterObject()
    * on obj
    */

			value: function createFilterFunc() {
				var mask = this;
				return function (obj) {
					return mask.filterObject(obj);
				};
			},
			writable: true,
			configurable: true
		}
	});

	return ObjectMask;
})();

module.exports = ObjectMask;
//# sourceMappingURL=data:application/json;base64,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QUFJLElBQUksR0FBRyxJQUFJLENBQUM7QUFDaEIsV0FBTyxVQUFTLEdBQUcsRUFBRTtBQUNwQixZQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLENBQUM7S0FDOUIsQ0FBQztJQUNGOzs7Ozs7UUFyYUksVUFBVTs7O0FBeWFoQixNQUFNLENBQUMsT0FBTyxHQUFHLFVBQVUsQ0FBQyIsImZpbGUiOiJsaWIvb2JqZWN0LW1hc2suanMiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgb2JqdG9vbHMgPSByZXF1aXJlKCcuL2luZGV4Jyk7XG5cbi8qKlxuICogVGhpcyBjbGFzcyByZXByZXNlbnRzIGEgbWFzaywgb3Igd2hpdGVsaXN0LCBvZiBmaWVsZHMgb24gYW4gb2JqZWN0LiAgU3VjaFxuICogYSBtYXNrIGlzIHN0b3JlZCBpbiBhIGZvcm1hdCB0aGF0IGxvb2tzIGxpa2UgdGhpczpcbiAqXG4gKiB7IGZvbzogdHJ1ZSwgYmFyOiB7IGJhejogdHJ1ZSB9IH1cbiAqXG4gKiBUaGlzIG1hc2sgYXBwbGllcyB0byB0aGUgcHJvcGVydGllcyBcImZvb1wiIGFuZCBcImJhci5iYXpcIiBvbiBhbiBvYmplY3QuXG4gKiBXaWxjYXJkcyBjYW4gYWxzbyBiZSB1c2VkOlxuICpcbiAqIHsgZm9vOiBmYWxzZSwgYmFyOiBmYWxzZSwgXzogdHJ1ZSB9XG4gKlxuICogVGhpcyB3aWxsIGFsbG93IGFsbCBmaWVsZHMgYnV0IGZvbyBhbmQgYmFyLiAgVGhlIHVzZSBvZiBhcnJheXMgd2l0aFxuICogYSBzaW5nbGUgZWxlbWVudCBpcyBlcXVpdmFsZW50IHRvIHRoZSB1c2Ugb2Ygd2lsZGNhcmRzLCBhcyBhcnJheXMgaW5cbiAqIHRoZSBtYXNrZWQgb2JqZWN0IGFyZSB0cmVhdGVkIGFzIG9iamVjdHMgd2l0aCBudW1lcmljIGtleXMuICBUaGVzZVxuICogdHdvIG1hc2tzIGFyZSBlcXVpdmFsZW50OlxuICpcbiAqIHsgZm9vOiBbIHsgYmFyOiB0cnVlLCBiYXo6IHRydWUgfSBdIH1cbiAqXG4gKiB7IGZvbzogeyBfOiB7IGJhcjogdHJ1ZSwgYmF6OiB0cnVlIH0gfSB9XG4gKlxuICogQGNsYXNzIE9iamVjdE1hc2tcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtPYmplY3R9IG1hc2sgLSBUaGUgZGF0YSBmb3IgdGhlIG1hc2tcbiAqL1xuY2xhc3MgT2JqZWN0TWFzayB7XG5cblx0Y29uc3RydWN0b3IobWFzaykge1xuXHRcdHRoaXMubWFzayA9IG1hc2s7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBhIGNvcHkgb2YgdGhlIGdpdmVuIG9iamVjdCwgYnV0IG9ubHkgaW5jbHVkaW5nIHRoZSBmaWVsZHMgYWxsb3dlZCBieVxuXHQgKiB0aGUgbWFzay4gIElmIHRoZSBtYXNrZWRPdXRIb29rIGZ1bmN0aW9uIGlzIHByb3ZpZGVkLCBpdCBpcyBjYWxsZWQgZm9yXG5cdCAqIGVhY2ggZmllbGQgZGlzYWxsb3dlZCBieSB0aGUgbWFzayAoYXQgdGhlIGhpZ2hlc3QgbGV2ZWwgaXQgaXMgZGlzYWxsb3dlZCkuXG5cdCAqXG5cdCAqIEBtZXRob2QgZmlsdGVyT2JqZWN0XG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvYmogLSBPYmplY3QgdG8gZmlsdGVyXG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IFttYXNrZWRPdXRIb29rXSAtIEZ1bmN0aW9uIHRvIGNhbGwgZm9yIGZpZWxkcyBkaXNhbGxvd2VkXG5cdCAqIGJ5IHRoZSBtYXNrXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBtYXNrZWRPdXRIb29rLnBhdGggLSBQYXRoIG9uIHRoZSBvYmplY3QgdGhhdCB3YXMgbWFza2VkIG91dFxuXHQgKiBAcmV0dXJuIHtPYmplY3R9IC0gVGhlIG9iamVjdCBhZnRlciByZW1vdmluZyBtYXNrZWQgb3V0IGZpZWxkcy4gIE5vdGUgdGhhdFxuXHQgKiB0aGUgcmV0dXJuZWQgb2JqZWN0IG1heSBzdGlsbCBjb250YWluIHJlZmVyZW5jZXMgdG8gdGhlIG9yaWdpbmFsIG9iamVjdC5cblx0ICogRmllbGRzIHRoYXQgYXJlIG5vdCBtYXNrZWQgb3V0IGFyZSBjb3BpZWQgYnkgcmVmZXJlbmNlLlxuXHQgKi9cblx0ZmlsdGVyT2JqZWN0KG9iaiwgbWFza2VkT3V0SG9vaykge1xuXHRcdGxldCBtYXNrID0gdGhpcy5tYXNrO1xuXHRcdGZ1bmN0aW9uIGZpbHRlcihvYmosIG1hc2ssIHBhdGgpIHtcblx0XHRcdGlmIChtYXNrID09PSB0cnVlKSByZXR1cm4gb2JqO1xuXHRcdFx0aWYgKCFtYXNrIHx8IG9ianRvb2xzLmlzU2NhbGFyKG9iaikpIHtcblx0XHRcdFx0aWYgKG1hc2tlZE91dEhvb2spIG1hc2tlZE91dEhvb2socGF0aCk7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShtYXNrKSkge1xuXHRcdFx0XHRtYXNrID0geyBfOiBtYXNrWzBdIHx8IGZhbHNlIH07XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZW9mIG1hc2sgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdGxldCByZXN1bHRJc0FycmF5ID0gQXJyYXkuaXNBcnJheShvYmopO1xuXHRcdFx0XHRsZXQgcmVzdWx0T2JqID0gcmVzdWx0SXNBcnJheSA/IFtdIDoge307XG5cdFx0XHRcdGxldCBtYXNrVmFsLCByZXN1bHRWYWw7XG5cdFx0XHRcdGZvciAobGV0IGtleSBpbiBvYmopIHtcblx0XHRcdFx0XHRtYXNrVmFsID0gKG1hc2tba2V5XSA9PT0gdW5kZWZpbmVkKSA/IG1hc2suXyA6IG1hc2tba2V5XTtcblx0XHRcdFx0XHRyZXN1bHRWYWwgPSBmaWx0ZXIob2JqW2tleV0sIG1hc2tWYWwgfHwgZmFsc2UsIHBhdGggPyAocGF0aCArICcuJyArIGtleSkgOiBrZXkpO1xuXHRcdFx0XHRcdGlmIChyZXN1bHRWYWwgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0aWYgKHJlc3VsdElzQXJyYXkpIHJlc3VsdE9iai5wdXNoKHJlc3VsdFZhbCk7XG5cdFx0XHRcdFx0XHRlbHNlIHJlc3VsdE9ialtrZXldID0gcmVzdWx0VmFsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0T2JqO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKG1hc2tlZE91dEhvb2spIG1hc2tlZE91dEhvb2socGF0aCk7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmaWx0ZXIob2JqLCBtYXNrLCAnJyk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBhIHN1YnNlY3Rpb24gb2YgYSBtYXNrIGdpdmVuIGEgZG90LXNlcGFyYXRlZCBwYXRoIHRvIHRoZSBzdWJzZWN0aW9uLlxuXHQgKlxuXHQgKiBAbWV0aG9kIGdldFN1Yk1hc2tcblx0ICogQHBhcmFtIHtTdHJpbmd9IHBhdGggLSBEb3Qtc2VwYXJhdGVkIHBhdGggdG8gc3VibWFzayB0byBmZXRjaFxuXHQgKiBAcmV0dXJuIHtPYmplY3RNYXNrfSAtIE1hc2sgY29tcG9uZW50IGNvcnJlc3BvbmRpbmcgdG8gdGhlIHBhdGhcblx0ICovXG5cdGdldFN1Yk1hc2socGF0aCkge1xuXHRcdGxldCBtYXNrID0gdGhpcy5tYXNrO1xuXHRcdGxldCBwYXJ0cyA9IHBhdGguc3BsaXQoJy4nKTtcblx0XHRsZXQgY3VyID0gbWFzaztcblx0XHRmb3IgKGxldCBwYXJ0SWR4ID0gMDsgcGFydElkeCA8IHBhcnRzLmxlbmd0aDsgcGFydElkeCsrKSB7XG5cdFx0XHRpZiAoY3VyID09PSB0cnVlKSByZXR1cm4gdHJ1ZTtcblx0XHRcdGlmIChvYmp0b29scy5pc1NjYWxhcihjdXIpKSByZXR1cm4gZmFsc2U7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShjdXIpKSBjdXIgPSB7IF86IGN1clswXSB8fCBmYWxzZSB9O1xuXHRcdFx0bGV0IHBhcnQgPSBwYXJ0c1twYXJ0SWR4XTtcblx0XHRcdGN1ciA9IChjdXJbcGFydF0gPT09IHVuZGVmaW5lZCkgPyBjdXIuXyA6IGN1cltwYXJ0XTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBPYmplY3RNYXNrKGN1ciB8fCBmYWxzZSk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0cnVlIGlmIHRoZSBnaXZlbiBwYXRoIGlzIGFsbG93ZWQgYnkgdGhlIG1hc2suICBmYWxzZSBvdGhlcndpc2UuXG5cdCAqXG5cdCAqIEBtZXRob2QgY2hlY2tNYXNrUGF0aFxuXHQgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCAtIERvdC1zZXBhcmF0ZWQgcGF0aFxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSAtIFdoZXRoZXIgb3Igbm90IHRoZSBnaXZlbiBwYXRoIGlzIGFsbG93ZWRcblx0ICovXG5cdGNoZWNrUGF0aChwYXRoKSB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U3ViTWFzayhwYXRoKS5tYXNrID09PSB0cnVlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGludGVybmFsIG9iamVjdCB0aGF0IHJlcHJlc2VudHMgdGhpcyBtYXNrLlxuXHQgKlxuXHQgKiBAbWV0aG9kIHRvT2JqZWN0XG5cdCAqIEByZXR1cm4ge09iamVjdH0gLSBPYmplY3QgcmVwcmVzZW50YXRpb24gb2YgdGhpcyBtYXNrXG5cdCAqL1xuXHR0b09iamVjdCgpIHtcblx0XHRyZXR1cm4gdGhpcy5tYXNrO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbWJpbmVzIHR3byBvciBtb3JlIG1hc2tzIHN1Y2ggdGhhdCB0aGUgcmVzdWx0IG1hc2sgbWF0Y2hlcyBmaWVsZHMgbWF0Y2hlZCBieVxuXHQgKiBhbnkgb2YgdGhlIGNvbWJpbmVkIG1hc2tzLlxuXHQgKlxuXHQgKiBAbWV0aG9kIGFkZE1hc2tzXG5cdCAqIEBzdGF0aWNcblx0ICogQHBhcmFtIHtPYmplY3RNYXNrfE9iamVjdH0gbWFzazFcblx0ICogQHBhcmFtIHtPYmplY3RNYXNrfE9iamVjdH0gbWFzazIuLi5cblx0ICogQHJldHVybiB7T2JqZWN0TWFza30gLSBUaGUgcmVzdWx0IG9mIGFkZGluZyB0b2dldGhlciB0aGUgY29tcG9uZW50IG1hc2tzXG5cdCAqL1xuXHRzdGF0aWMgYWRkTWFza3MoKSB7XG5cdFx0bGV0IHJlc3VsdE1hc2sgPSBmYWxzZTtcblxuXHRcdC8vIEFkZHMgYSBzaW5nbGUgbWFzayAoZnJvbU1hc2spIGludG8gdGhlIHJlc3VsdE1hc2sgbWFzayBpbi1wbGFjZS4gIHRvTWFzayBzaG91bGQgYmUgYW4gb2JqZWN0LlxuXHRcdC8vIElmIHRoZSByZXN1bHRpbmcgbWFzayBpcyBhIGJvb2xlYW4gdHJ1ZSwgdGhpcyBmdW5jdGlvbiByZXR1cm5zIHRydWUuICBPdGhlcndpc2UsIGl0IHJldHVybnMgdG9NYXNrLlxuXHRcdGZ1bmN0aW9uIGFkZE1hc2socmVzdWx0TWFzaywgbmV3TWFzaykge1xuXHRcdFx0bGV0IGtleTtcblxuXHRcdFx0aWYgKHJlc3VsdE1hc2sgPT09IHRydWUpIHJldHVybiB0cnVlO1xuXHRcdFx0aWYgKG5ld01hc2sgPT09IHRydWUpIHtcblx0XHRcdFx0cmVzdWx0TWFzayA9IHRydWU7XG5cdFx0XHRcdHJldHVybiByZXN1bHRNYXNrO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9ianRvb2xzLmlzU2NhbGFyKG5ld01hc2spKSByZXR1cm4gcmVzdWx0TWFzaztcblx0XHRcdGlmIChvYmp0b29scy5pc1NjYWxhcihyZXN1bHRNYXNrKSkge1xuXHRcdFx0XHRyZXN1bHRNYXNrID0gb2JqdG9vbHMuZGVlcENvcHkobmV3TWFzayk7XG5cdFx0XHRcdHJldHVybiByZXN1bHRNYXNrO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShyZXN1bHRNYXNrKSkge1xuXHRcdFx0XHRyZXN1bHRNYXNrID0geyBfOiByZXN1bHRNYXNrWzBdIHx8IGZhbHNlIH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShuZXdNYXNrKSkge1xuXHRcdFx0XHRuZXdNYXNrID0geyBfOiBuZXdNYXNrWzBdIHx8IGZhbHNlIH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHRoZXJlIGFyZSBrZXlzIHRoYXQgZXhpc3QgaW4gcmVzdWx0IGJ1dCBub3QgaW4gdGhlIG5ld01hc2ssXG5cdFx0XHQvLyBhbmQgdGhlIHJlc3VsdCBtYXNrIGhhcyBhIF8ga2V5ICh3aWxkY2FyZCksIGNvbWJpbmVcblx0XHRcdC8vIHRoZSB3aWxkY2FyZCBtYXNrIHdpdGggdGhlIG5ldyBtYXNrLCBiZWNhdXNlIGluIHRoZSBleGlzdGluZ1xuXHRcdFx0Ly8gcmVzdWx0IG1hc2ssIHRoYXQga2V5IGhhcyB0aGUgd2lsZGNhcmQgcGVybWlzc2lvbnNcblx0XHRcdGlmIChuZXdNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRmb3IgKGtleSBpbiByZXN1bHRNYXNrKSB7XG5cdFx0XHRcdFx0aWYgKGtleSA9PT0gJ18nKSBjb250aW51ZTtcblx0XHRcdFx0XHRpZiAobmV3TWFza1trZXldID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGFkZE1hc2socmVzdWx0TWFza1trZXldLCBuZXdNYXNrLl8pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBzYW1lIGhlcmUgLi4uIGFsc28sIGNvcHkgb3ZlciBvciBtZXJnZSBmaWVsZHNcblx0XHRcdGZvciAoa2V5IGluIG5ld01hc2spIHtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ18nKSBjb250aW51ZTtcblx0XHRcdFx0aWYgKHJlc3VsdE1hc2tba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gYWRkTWFzayhyZXN1bHRNYXNrW2tleV0sIG5ld01hc2tba2V5XSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAocmVzdWx0TWFzay5fICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXN1bHRNYXNrW2tleV0gPSBhZGRNYXNrKG9ianRvb2xzLmRlZXBDb3B5KG5ld01hc2tba2V5XSksIHJlc3VsdE1hc2suXyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gb2JqdG9vbHMuZGVlcENvcHkobmV3TWFza1trZXldKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gZmlsbCBpbiB0aGUgXyBrZXkgdGhhdCB3ZSBza2lwcGVkIGVhcmxpZXJcblx0XHRcdGlmIChuZXdNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpZiAocmVzdWx0TWFzay5fICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXN1bHRNYXNrLl8gPSBhZGRNYXNrKHJlc3VsdE1hc2suXywgbmV3TWFzay5fKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHRNYXNrLl8gPSBvYmp0b29scy5kZWVwQ29weShuZXdNYXNrLl8pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHRoZXJlIGlzIGEgd2lsZGNhcmQsIHJlbW92ZSBhbnkga2V5cyB0aGF0IGFyZSBzZXQgdG8gdGhlIHNhbWUgdGhpbmcgYXMgdGhlIHdpbGRjYXJkXG5cdFx0XHQvLyBUaGlzIGlzbid0IHN0cmljdGx5IG5lY2Vzc2FyeSwgYnV0IHJlbW92ZXMgcmVkdW5kYW50IGRhdGFcblx0XHRcdGlmIChyZXN1bHRNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRmb3IgKGtleSBpbiByZXN1bHRNYXNrKSB7XG5cdFx0XHRcdFx0aWYgKGtleSAhPT0gJ18nICYmIG9ianRvb2xzLmRlZXBFcXVhbHMocmVzdWx0TWFza1trZXldLCByZXN1bHRNYXNrLl8pKSB7XG5cdFx0XHRcdFx0XHRkZWxldGUgcmVzdWx0TWFza1trZXldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gcmVzdWx0TWFzayB8fCBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgY3VyQXJnO1xuXHRcdGZvciAobGV0IGFyZ0lkeCA9IDA7IGFyZ0lkeCA8IGFyZ3VtZW50cy5sZW5ndGg7IGFyZ0lkeCsrKSB7XG5cdFx0XHRjdXJBcmcgPSBhcmd1bWVudHNbYXJnSWR4XTtcblx0XHRcdGlmIChjdXJBcmcgaW5zdGFuY2VvZiBPYmplY3RNYXNrKSB7XG5cdFx0XHRcdGN1ckFyZyA9IGN1ckFyZy50b09iamVjdCgpO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0TWFzayA9IGFkZE1hc2socmVzdWx0TWFzaywgY3VyQXJnKTtcblx0XHRcdGlmIChyZXN1bHRNYXNrID09PSB0cnVlKSByZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBPYmplY3RNYXNrKHJlc3VsdE1hc2sgfHwgZmFsc2UpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZHMgYSBzZXQgb2YgbWFza3MgdG9nZXRoZXIsIGJ1dCB1c2luZyBhIGxvZ2ljYWwgQU5EIGluc3RlYWQgb2YgYSBsb2dpY2FsIE9SIChhcyBpbiBhZGRNYXNrcykuXG5cdCAqIElFLCBhIGZpZWxkIG11c3QgYmUgYWxsb3dlZCBpbiBhbGwgZ2l2ZW4gbWFza3MgdG8gYmUgaW4gdGhlIHJlc3VsdCBtYXNrLlxuXHQgKlxuXHQgKiBAbWV0aG9kIGFuZE1hc2tzXG5cdCAqIEBzdGF0aWNcblx0ICogQHBhcmFtIHtPYmplY3RNYXNrfE9iamVjdH0gbWFzazFcblx0ICogQHBhcmFtIHtPYmplY3RNYXNrfE9iamVjdH0gbWFzazIuLi5cblx0ICogQHJldHVybiB7T2JqZWN0TWFza30gLSBUaGUgcmVzdWx0IG9mIEFORGluZyB0b2dldGhlciB0aGUgY29tcG9uZW50IG1hc2tzXG5cdCAqL1xuXHRzdGF0aWMgYW5kTWFza3MoKSB7XG5cdFx0bGV0IHJlc3VsdE1hc2sgPSB0cnVlO1xuXG5cdFx0ZnVuY3Rpb24gYW5kTWFzayhyZXN1bHRNYXNrLCBuZXdNYXNrKSB7XG5cdFx0XHRsZXQga2V5O1xuXG5cdFx0XHQvLyBEZWdlbmVyYXRlIGNhc2VzXG5cdFx0XHRpZiAocmVzdWx0TWFzayA9PT0gdHJ1ZSkgcmV0dXJuIG9ianRvb2xzLmRlZXBDb3B5KG5ld01hc2spO1xuXHRcdFx0aWYgKG5ld01hc2sgPT09IHRydWUpIHJldHVybiByZXN1bHRNYXNrO1xuXHRcdFx0aWYgKG9ianRvb2xzLmlzU2NhbGFyKHJlc3VsdE1hc2spIHx8IG9ianRvb2xzLmlzU2NhbGFyKG5ld01hc2spKSByZXR1cm4gZmFsc2U7XG5cblx0XHRcdC8vIFJlc29sdmUgYXJyYXlzXG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShyZXN1bHRNYXNrKSkge1xuXHRcdFx0XHRyZXN1bHRNYXNrID0geyBfOiByZXN1bHRNYXNrWzBdIHx8IGZhbHNlIH07XG5cdFx0XHR9XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShuZXdNYXNrKSkge1xuXHRcdFx0XHRuZXdNYXNrID0geyBfOiBuZXdNYXNrWzBdIHx8IGZhbHNlIH07XG5cdFx0XHR9XG5cblx0XHRcdC8vIEhhbmRsZSBrZXlzIHRoYXQgZXhpc3QgaW4gYm90aCBtYXNrcywgZXhjZXB0aW5nIF9cblx0XHRcdGZvciAoa2V5IGluIG5ld01hc2spIHtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ18nKSBjb250aW51ZTtcblx0XHRcdFx0aWYgKHJlc3VsdE1hc2tba2V5XSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gYW5kTWFzayhyZXN1bHRNYXNrW2tleV0sIG5ld01hc2tba2V5XSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSGFuZGxlIGtleXMgdGhhdCBleGlzdCBpbiByZXN1bHRNYXNrIGJ1dCBub3QgaW4gbmV3TWFza1xuXHRcdFx0Zm9yIChrZXkgaW4gcmVzdWx0TWFzaykge1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnXycpIGNvbnRpbnVlO1xuXHRcdFx0XHRpZiAobmV3TWFza1trZXldID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRpZiAobmV3TWFzay5fICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGFuZE1hc2socmVzdWx0TWFza1trZXldLCBuZXdNYXNrLl8pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXN1bHRNYXNrW2tleV0gPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSGFuZGxlIGtleXMgdGhhdCBleGlzdCBpbiBuZXdNYXNrIGJ1dCBub3QgcmVzdWx0TWFza1xuXHRcdFx0Zm9yIChrZXkgaW4gbmV3TWFzaykge1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnXycpIGNvbnRpbnVlO1xuXHRcdFx0XHRpZiAocmVzdWx0TWFza1trZXldID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRpZiAocmVzdWx0TWFzay5fICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGFuZE1hc2sob2JqdG9vbHMuZGVlcENvcHkobmV3TWFza1trZXldKSwgcmVzdWx0TWFzay5fKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEhhbmRsZSBfICh3aWxkY2FyZCBmaWVsZHMpXG5cdFx0XHRpZiAobmV3TWFzay5fICE9PSB1bmRlZmluZWQgJiYgcmVzdWx0TWFzay5fICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmVzdWx0TWFzay5fID0gYW5kTWFzayhyZXN1bHRNYXNrLl8sIG5ld01hc2suXyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkZWxldGUgcmVzdWx0TWFzay5fO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUbyBjb25kZW5zZSBzb21lIGNhc2VzLCByZW1vdmUgdW5uZWNlc3NhcnkgZmFsc3kgdmFsdWVzXG5cdFx0XHRpZiAoIXJlc3VsdE1hc2suXykge1xuXHRcdFx0XHRkZWxldGUgcmVzdWx0TWFzay5fO1xuXHRcdFx0XHQvLyBTaW5jZSBhbGwgdmFsdWVzIHdpbGwgZGVmYXVsdCB0byBmYWxzZSwgd2UgY2FuIHJlbW92ZSBhbnkgZmFsc3kgdmFsdWVzXG5cdFx0XHRcdGZvciAoa2V5IGluIHJlc3VsdE1hc2spIHtcblx0XHRcdFx0XHRpZiAoIXJlc3VsdE1hc2tba2V5XSkge1xuXHRcdFx0XHRcdFx0ZGVsZXRlIHJlc3VsdE1hc2tba2V5XTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgdGhlcmUgYXJlIG5vIGtleXMgbGVmdCBpbiByZXN1bHRNYXNrLCBjb25kZW5zZSB0byBmYWxzZVxuXHRcdFx0aWYgKCFPYmplY3Qua2V5cyhyZXN1bHRNYXNrKS5sZW5ndGgpIHJldHVybiBmYWxzZTtcblxuXHRcdFx0cmV0dXJuIHJlc3VsdE1hc2s7XG5cdFx0fVxuXG5cdFx0bGV0IGN1ckFyZztcblx0XHRmb3IgKGxldCBhcmdJZHggPSAwOyBhcmdJZHggPCBhcmd1bWVudHMubGVuZ3RoOyBhcmdJZHgrKykge1xuXHRcdFx0Y3VyQXJnID0gYXJndW1lbnRzW2FyZ0lkeF07XG5cdFx0XHRpZiAoY3VyQXJnIGluc3RhbmNlb2YgT2JqZWN0TWFzaykge1xuXHRcdFx0XHRjdXJBcmcgPSBjdXJBcmcudG9PYmplY3QoKTtcblx0XHRcdH1cblx0XHRcdHJlc3VsdE1hc2sgPSBhbmRNYXNrKHJlc3VsdE1hc2ssIGN1ckFyZyk7XG5cdFx0XHRpZiAocmVzdWx0TWFzayA9PT0gZmFsc2UpIHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBPYmplY3RNYXNrKHJlc3VsdE1hc2sgfHwgZmFsc2UpO1xuXHR9XG5cblxuXHQvKipcblx0ICogQ2hlY2sgaWYgYSBtYXNrIGlzIHZhbGlkIGluIHN0cmljdCBmb3JtIChpZSwgaXQgb25seSBjb250YWlucyBvYmplY3RzIGFuZCBib29sZWFucylcblx0ICpcblx0ICogQG1ldGhvZCB2YWxpZGF0ZVxuXHQgKiBAcmV0dXJuIHtCb29sZWFufSAtIFdoZXRoZXIgb3Igbm90IHRoZSBtYXNrIGlzIHN0cmljdGx5IHZhbGlkXG5cdCAqL1xuXHR2YWxpZGF0ZSgpIHtcblx0XHRmdW5jdGlvbiB2YWxXaGl0ZWxpc3Qod2hpdGVsaXN0KSB7XG5cdFx0XHRpZiAod2hpdGVsaXN0ICE9PSB0cnVlICYmIHdoaXRlbGlzdCAhPT0gZmFsc2UgJiYgb2JqdG9vbHMuaXNTY2FsYXIod2hpdGVsaXN0KSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0aWYgKHR5cGVvZiB3aGl0ZWxpc3QgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdGZvciAobGV0IGtleSBpbiB3aGl0ZWxpc3QpIHtcblx0XHRcdFx0XHRpZiAoIXZhbFdoaXRlbGlzdCh3aGl0ZWxpc3Rba2V5XSkpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiB2YWxXaGl0ZWxpc3QodGhpcy5tYXNrKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGZpZWxkcyBpbiB0aGUgZ2l2ZW4gb2JqZWN0IHdoaWNoIGFyZSByZXN0cmljdGVkIGJ5IHRoZSBnaXZlbiBtYXNrXG5cdCAqXG5cdCAqIEBtZXRob2QgZ2V0TWFza2VkT3V0RmllbGRzXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvYmogLSBUaGUgb2JqZWN0IHRvIGNoZWNrIGFnYWluc3Rcblx0ICogQHJldHVybiB7U3RyaW5nW119IC0gUGF0aHMgdG8gZmllbGRzIHRoYXQgYXJlIHJlc3RyaWN0ZWQgYnkgdGhlIG1hc2tcblx0ICovXG5cdGdldE1hc2tlZE91dEZpZWxkcyhvYmopIHtcblx0XHRsZXQgbWFza2VkT3V0ID0gW107XG5cdFx0dGhpcy5maWx0ZXJPYmplY3Qob2JqLCBmdW5jdGlvbihwYXRoKSB7XG5cdFx0XHRtYXNrZWRPdXQucHVzaChwYXRoKTtcblx0XHR9KTtcblx0XHRyZXR1cm4gbWFza2VkT3V0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEdpdmVuIGEgZG90LW5vdGF0aW9uIG1hcHBpbmcgZnJvbSBmaWVsZHMgdG8gdmFsdWVzLCByZW1vdmUgYWxsIGZpZWxkcyB0aGF0IGFyZSBub3Rcblx0ICogYWxsb3dlZCBieSB0aGUgbWFzay5cblx0ICpcblx0ICogQG1ldGhvZCBmaWx0ZXJEb3R0ZWRPYmplY3Rcblx0ICogQHBhcmFtIHtPYmplY3R9IGRvdHRlZE9iaiAtIE1hcCBmcm9tIGRvdHRlZCBwYXRocyB0byB2YWx1ZXMsIHN1Y2ggYXMgeyBcImZvby5iYXJcIjogXCJiYXpcIiB9XG5cdCAqIEBwYXJhbSB7RnVuY3Rpb259IFttYXNrZWRPdXRIb29rXSAtIEZ1bmN0aW9uIHRvIGNhbGwgZm9yIHJlbW92ZWQgZmllbGRzXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBtYXNrZWRPdXRIb29rLnBhdGggLSBQYXRoIG9mIHRoZSBtYXNrZWQgb3V0IGZpZWxkXG5cdCAqIEByZXR1cm4ge09iamVjdH0gLSBUaGUgcmVzdWx0XG5cdCAqL1xuXHRmaWx0ZXJEb3R0ZWRPYmplY3QoZG90dGVkT2JqLCBtYXNrZWRPdXRIb29rKSB7XG5cdFx0bGV0IHJlc3VsdE9iaiA9IHt9O1xuXHRcdGZvciAobGV0IGtleSBpbiBkb3R0ZWRPYmopIHtcblx0XHRcdGlmICghdGhpcy5jaGVja1BhdGgoa2V5KSkge1xuXHRcdFx0XHRpZiAobWFza2VkT3V0SG9vaykge1xuXHRcdFx0XHRcdG1hc2tlZE91dEhvb2soa2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0T2JqW2tleV0gPSBkb3R0ZWRPYmpba2V5XTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdE9iajtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFuIGFycmF5IG9mIGZpZWxkcyBpbiB0aGUgZ2l2ZW4gb2JqZWN0IHdoaWNoIGFyZSByZXN0cmljdGVkIGJ5IHRoZSBnaXZlbiBtYXNrLiAgVGhlXG5cdCAqIG9iamVjdCBpcyBpbiBkb3R0ZWQgbm90YXRpb24gYXMgaW4gZmlsdGVyRG90dGVkT2JqZWN0KClcblx0ICpcblx0ICogQG1ldGhvZCBnZXREb3R0ZWRNYXNrZWRPdXRGaWVsZHNcblx0ICogQHBhcmFtIHtPYmplY3R9IG9iaiAtIFRoZSBvYmplY3QgdG8gY2hlY2sgYWdhaW5zdFxuXHQgKiBAcmV0dXJuIHtTdHJpbmdbXX0gLSBQYXRocyB0byBmaWVsZHMgdGhhdCBhcmUgcmVzdHJpY3RlZCBieSB0aGUgbWFza1xuXHQgKi9cblx0Z2V0RG90dGVkTWFza2VkT3V0RmllbGRzKG9iaikge1xuXHRcdGxldCBtYXNrZWRPdXQgPSBbXTtcblx0XHR0aGlzLmZpbHRlckRvdHRlZE9iamVjdChvYmosIGZ1bmN0aW9uKHBhdGgpIHtcblx0XHRcdG1hc2tlZE91dC5wdXNoKHBhdGgpO1xuXHRcdH0pO1xuXHRcdHJldHVybiBtYXNrZWRPdXQ7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSBzdHJ1Y3R1cmVkIGRvY3VtZW50LCBlbnN1cmVzIHRoYXRcblx0ICogYWxsIGZpZWxkcyBhcmUgYWxsb3dlZCBieSB0aGUgZ2l2ZW4gbWFzay4gIFJldHVybnMgdHJ1ZSBvciBmYWxzZS5cblx0ICpcblx0ICogQG1ldGhvZCBjaGVja0ZpZWxkc1xuXHQgKiBAcGFyYW0ge09iamVjdH0gb2JqXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59XG5cdCAqL1xuXHRjaGVja0ZpZWxkcyhvYmopIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRNYXNrZWRPdXRGaWVsZHMob2JqKS5sZW5ndGggPT09IDA7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSBkb3Qtbm90YXRpb24gbWFwcGluZyBmcm9tIGZpZWxkcyB0byB2YWx1ZXMgKG9ubHkgMSBsZXZlbCBkZWVwIGlzIGNoZWNrZWQpLFxuXHQgKiBlbnN1cmUgdGhhdCBhbGwgZmllbGRzIGFyZSBpbiB0aGUgKHN0cnVjdHVyZWQpIG1hc2suXG5cdCAqXG5cdCAqIEBtZXRob2QgY2hlY2tEb3R0ZWRGaWVsZHNcblx0ICogQHBhcmFtIHtPYmplY3R9IGRvdHRlZE9iaiAtIE1hcHBpbmcgZnJvbSBkb3Qtc2VwYXJhdGVkIHBhdGhzIHRvIHZhbHVlc1xuXHQgKiBAcmV0dXJuIHtCb29sZWFufVxuXHQgKi9cblx0Y2hlY2tEb3R0ZWRGaWVsZHMoZG90dGVkT2JqKSB7XG5cdFx0bGV0IHNlbGYgPSB0aGlzO1xuXHRcdHJldHVybiBPYmplY3Qua2V5cyhkb3R0ZWRPYmopLmV2ZXJ5KGZ1bmN0aW9uKHBhdGgpIHtcblx0XHRcdHJldHVybiBzZWxmLmNoZWNrUGF0aChwYXRoKTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgc3RydWN0dXJlZCBtYXNrIGdpdmVuIGEgbGlzdCBvZiBmaWVsZHMgdGhhdCBzaG91bGQgYmUgaW5jbHVkZWQgaW4gdGhlIG1hc2suXG5cdCAqXG5cdCAqIEBtZXRob2QgY3JlYXRlTWFza0Zyb21GaWVsZExpc3Rcblx0ICogQHN0YXRpY1xuXHQgKiBAcGFyYW0ge1N0cmluZ1tdfSBmaWVsZHMgLSBBcnJheSBvZiBmaWVsZHMgdG8gaW5jbHVkZVxuXHQgKiBAcmV0dXJuIHtPYmplY3RNYXNrfSAtIFRoZSBjcmVhdGVkIG1hc2tcblx0ICovXG5cdHN0YXRpYyBjcmVhdGVNYXNrRnJvbUZpZWxkTGlzdChmaWVsZHMpIHtcblx0XHRsZXQgcmV0ID0ge307XG5cdFx0Ly8gV2Ugc29ydCBmaWVsZHMgYnkgbGVuZ3RoLCBsb25nIHRvIHNob3J0LCB0byBhdm9pZCBtb3JlIHNwZWNpZmljIGZpZWxkcyBjbG9iYmVyaW5nXG5cdFx0Ly8gbGVzcyBzcGVjaWZpYyBmaWVsZHMuXG5cdFx0ZmllbGRzID0gZmllbGRzLnNsaWNlKDApLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0cmV0dXJuIGIubGVuZ3RoIC0gYS5sZW5ndGg7XG5cdFx0fSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmaWVsZHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdG9ianRvb2xzLnNldFBhdGgocmV0LCBmaWVsZHNbaV0sIHRydWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IE9iamVjdE1hc2socmV0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBmaWx0ZXJzIG9iamVjdCBmaWVsZHMgYmFzZWQgb24gYSBzdHJ1Y3R1cmVkIG1hc2svd2hpdGVsaXN0LlxuXHQgKlxuXHQgKiBAbWV0aG9kIGNyZWF0ZUZpbHRlckZ1bmNcblx0ICogQHN0YXRpY1xuXHQgKiBAcmV0dXJuIHtGdW5jdGlvbn0gLSBBIGZ1bmN0aW9uKG9iaikgdGhhdCBpcyB0aGUgZXF1aXZhbGVudCBvZiBjYWxsaW5nIGZpbHRlck9iamVjdCgpXG5cdCAqIG9uIG9ialxuXHQgKi9cblx0Y3JlYXRlRmlsdGVyRnVuYygpIHtcblx0XHRsZXQgbWFzayA9IHRoaXM7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uKG9iaikge1xuXHRcdFx0cmV0dXJuIG1hc2suZmlsdGVyT2JqZWN0KG9iaik7XG5cdFx0fTtcblx0fVxuXG59XG5cbm1vZHVsZS5leHBvcnRzID0gT2JqZWN0TWFzaztcbiJdfQ==