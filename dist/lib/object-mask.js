"use strict";

var _classCallCheck = require("babel-runtime/helpers/class-call-check").default;

var _createClass = require("babel-runtime/helpers/create-class").default;

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
		_classCallCheck(this, ObjectMask);

		this.mask = mask;
	}

	_createClass(ObjectMask, {
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
			}
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
			}
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
			}
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
			}
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
			}
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
			}
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
			}
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
			}
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
			}
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
			}
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
			}
		}
	}, {
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
			}
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
			}
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
			}
		}
	});

	return ObjectMask;
})();

module.exports = ObjectMask;
//# sourceMappingURL=data:application/json;base64,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TUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQ3ZDO0FBQ0QsV0FBTyxJQUFJLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUMzQjs7OztRQXRaSSxVQUFVOzs7QUF5YWhCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsVUFBVSxDQUFDIiwiZmlsZSI6ImxpYi9vYmplY3QtbWFzay5qcyIsInNvdXJjZXNDb250ZW50IjpbImxldCBvYmp0b29scyA9IHJlcXVpcmUoJy4vaW5kZXgnKTtcblxuLyoqXG4gKiBUaGlzIGNsYXNzIHJlcHJlc2VudHMgYSBtYXNrLCBvciB3aGl0ZWxpc3QsIG9mIGZpZWxkcyBvbiBhbiBvYmplY3QuICBTdWNoXG4gKiBhIG1hc2sgaXMgc3RvcmVkIGluIGEgZm9ybWF0IHRoYXQgbG9va3MgbGlrZSB0aGlzOlxuICpcbiAqIHsgZm9vOiB0cnVlLCBiYXI6IHsgYmF6OiB0cnVlIH0gfVxuICpcbiAqIFRoaXMgbWFzayBhcHBsaWVzIHRvIHRoZSBwcm9wZXJ0aWVzIFwiZm9vXCIgYW5kIFwiYmFyLmJhelwiIG9uIGFuIG9iamVjdC5cbiAqIFdpbGNhcmRzIGNhbiBhbHNvIGJlIHVzZWQ6XG4gKlxuICogeyBmb286IGZhbHNlLCBiYXI6IGZhbHNlLCBfOiB0cnVlIH1cbiAqXG4gKiBUaGlzIHdpbGwgYWxsb3cgYWxsIGZpZWxkcyBidXQgZm9vIGFuZCBiYXIuICBUaGUgdXNlIG9mIGFycmF5cyB3aXRoXG4gKiBhIHNpbmdsZSBlbGVtZW50IGlzIGVxdWl2YWxlbnQgdG8gdGhlIHVzZSBvZiB3aWxkY2FyZHMsIGFzIGFycmF5cyBpblxuICogdGhlIG1hc2tlZCBvYmplY3QgYXJlIHRyZWF0ZWQgYXMgb2JqZWN0cyB3aXRoIG51bWVyaWMga2V5cy4gIFRoZXNlXG4gKiB0d28gbWFza3MgYXJlIGVxdWl2YWxlbnQ6XG4gKlxuICogeyBmb286IFsgeyBiYXI6IHRydWUsIGJhejogdHJ1ZSB9IF0gfVxuICpcbiAqIHsgZm9vOiB7IF86IHsgYmFyOiB0cnVlLCBiYXo6IHRydWUgfSB9IH1cbiAqXG4gKiBAY2xhc3MgT2JqZWN0TWFza1xuICogQGNvbnN0cnVjdG9yXG4gKiBAcGFyYW0ge09iamVjdH0gbWFzayAtIFRoZSBkYXRhIGZvciB0aGUgbWFza1xuICovXG5jbGFzcyBPYmplY3RNYXNrIHtcblxuXHRjb25zdHJ1Y3RvcihtYXNrKSB7XG5cdFx0dGhpcy5tYXNrID0gbWFzaztcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgY29weSBvZiB0aGUgZ2l2ZW4gb2JqZWN0LCBidXQgb25seSBpbmNsdWRpbmcgdGhlIGZpZWxkcyBhbGxvd2VkIGJ5XG5cdCAqIHRoZSBtYXNrLiAgSWYgdGhlIG1hc2tlZE91dEhvb2sgZnVuY3Rpb24gaXMgcHJvdmlkZWQsIGl0IGlzIGNhbGxlZCBmb3Jcblx0ICogZWFjaCBmaWVsZCBkaXNhbGxvd2VkIGJ5IHRoZSBtYXNrIChhdCB0aGUgaGlnaGVzdCBsZXZlbCBpdCBpcyBkaXNhbGxvd2VkKS5cblx0ICpcblx0ICogQG1ldGhvZCBmaWx0ZXJPYmplY3Rcblx0ICogQHBhcmFtIHtPYmplY3R9IG9iaiAtIE9iamVjdCB0byBmaWx0ZXJcblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gW21hc2tlZE91dEhvb2tdIC0gRnVuY3Rpb24gdG8gY2FsbCBmb3IgZmllbGRzIGRpc2FsbG93ZWRcblx0ICogYnkgdGhlIG1hc2tcblx0ICogQHBhcmFtIHtTdHJpbmd9IG1hc2tlZE91dEhvb2sucGF0aCAtIFBhdGggb24gdGhlIG9iamVjdCB0aGF0IHdhcyBtYXNrZWQgb3V0XG5cdCAqIEByZXR1cm4ge09iamVjdH0gLSBUaGUgb2JqZWN0IGFmdGVyIHJlbW92aW5nIG1hc2tlZCBvdXQgZmllbGRzLiAgTm90ZSB0aGF0XG5cdCAqIHRoZSByZXR1cm5lZCBvYmplY3QgbWF5IHN0aWxsIGNvbnRhaW4gcmVmZXJlbmNlcyB0byB0aGUgb3JpZ2luYWwgb2JqZWN0LlxuXHQgKiBGaWVsZHMgdGhhdCBhcmUgbm90IG1hc2tlZCBvdXQgYXJlIGNvcGllZCBieSByZWZlcmVuY2UuXG5cdCAqL1xuXHRmaWx0ZXJPYmplY3Qob2JqLCBtYXNrZWRPdXRIb29rKSB7XG5cdFx0bGV0IG1hc2sgPSB0aGlzLm1hc2s7XG5cdFx0ZnVuY3Rpb24gZmlsdGVyKG9iaiwgbWFzaywgcGF0aCkge1xuXHRcdFx0aWYgKG1hc2sgPT09IHRydWUpIHJldHVybiBvYmo7XG5cdFx0XHRpZiAoIW1hc2sgfHwgb2JqdG9vbHMuaXNTY2FsYXIob2JqKSkge1xuXHRcdFx0XHRpZiAobWFza2VkT3V0SG9vaykgbWFza2VkT3V0SG9vayhwYXRoKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KG1hc2spKSB7XG5cdFx0XHRcdG1hc2sgPSB7IF86IG1hc2tbMF0gfHwgZmFsc2UgfTtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgbWFzayA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0bGV0IHJlc3VsdElzQXJyYXkgPSBBcnJheS5pc0FycmF5KG9iaik7XG5cdFx0XHRcdGxldCByZXN1bHRPYmogPSByZXN1bHRJc0FycmF5ID8gW10gOiB7fTtcblx0XHRcdFx0bGV0IG1hc2tWYWwsIHJlc3VsdFZhbDtcblx0XHRcdFx0Zm9yIChsZXQga2V5IGluIG9iaikge1xuXHRcdFx0XHRcdG1hc2tWYWwgPSAobWFza1trZXldID09PSB1bmRlZmluZWQpID8gbWFzay5fIDogbWFza1trZXldO1xuXHRcdFx0XHRcdHJlc3VsdFZhbCA9IGZpbHRlcihvYmpba2V5XSwgbWFza1ZhbCB8fCBmYWxzZSwgcGF0aCA/IChwYXRoICsgJy4nICsga2V5KSA6IGtleSk7XG5cdFx0XHRcdFx0aWYgKHJlc3VsdFZhbCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0XHRpZiAocmVzdWx0SXNBcnJheSkgcmVzdWx0T2JqLnB1c2gocmVzdWx0VmFsKTtcblx0XHRcdFx0XHRcdGVsc2UgcmVzdWx0T2JqW2tleV0gPSByZXN1bHRWYWw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHRPYmo7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAobWFza2VkT3V0SG9vaykgbWFza2VkT3V0SG9vayhwYXRoKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZpbHRlcihvYmosIG1hc2ssICcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgc3Vic2VjdGlvbiBvZiBhIG1hc2sgZ2l2ZW4gYSBkb3Qtc2VwYXJhdGVkIHBhdGggdG8gdGhlIHN1YnNlY3Rpb24uXG5cdCAqXG5cdCAqIEBtZXRob2QgZ2V0U3ViTWFza1xuXHQgKiBAcGFyYW0ge1N0cmluZ30gcGF0aCAtIERvdC1zZXBhcmF0ZWQgcGF0aCB0byBzdWJtYXNrIHRvIGZldGNoXG5cdCAqIEByZXR1cm4ge09iamVjdE1hc2t9IC0gTWFzayBjb21wb25lbnQgY29ycmVzcG9uZGluZyB0byB0aGUgcGF0aFxuXHQgKi9cblx0Z2V0U3ViTWFzayhwYXRoKSB7XG5cdFx0bGV0IG1hc2sgPSB0aGlzLm1hc2s7XG5cdFx0bGV0IHBhcnRzID0gcGF0aC5zcGxpdCgnLicpO1xuXHRcdGxldCBjdXIgPSBtYXNrO1xuXHRcdGZvciAobGV0IHBhcnRJZHggPSAwOyBwYXJ0SWR4IDwgcGFydHMubGVuZ3RoOyBwYXJ0SWR4KyspIHtcblx0XHRcdGlmIChjdXIgPT09IHRydWUpIHJldHVybiB0cnVlO1xuXHRcdFx0aWYgKG9ianRvb2xzLmlzU2NhbGFyKGN1cikpIHJldHVybiBmYWxzZTtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGN1cikpIGN1ciA9IHsgXzogY3VyWzBdIHx8IGZhbHNlIH07XG5cdFx0XHRsZXQgcGFydCA9IHBhcnRzW3BhcnRJZHhdO1xuXHRcdFx0Y3VyID0gKGN1cltwYXJ0XSA9PT0gdW5kZWZpbmVkKSA/IGN1ci5fIDogY3VyW3BhcnRdO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IE9iamVjdE1hc2soY3VyIHx8IGZhbHNlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRydWUgaWYgdGhlIGdpdmVuIHBhdGggaXMgYWxsb3dlZCBieSB0aGUgbWFzay4gIGZhbHNlIG90aGVyd2lzZS5cblx0ICpcblx0ICogQG1ldGhvZCBjaGVja01hc2tQYXRoXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoIC0gRG90LXNlcGFyYXRlZCBwYXRoXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59IC0gV2hldGhlciBvciBub3QgdGhlIGdpdmVuIHBhdGggaXMgYWxsb3dlZFxuXHQgKi9cblx0Y2hlY2tQYXRoKHBhdGgpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRTdWJNYXNrKHBhdGgpLm1hc2sgPT09IHRydWU7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgaW50ZXJuYWwgb2JqZWN0IHRoYXQgcmVwcmVzZW50cyB0aGlzIG1hc2suXG5cdCAqXG5cdCAqIEBtZXRob2QgdG9PYmplY3Rcblx0ICogQHJldHVybiB7T2JqZWN0fSAtIE9iamVjdCByZXByZXNlbnRhdGlvbiBvZiB0aGlzIG1hc2tcblx0ICovXG5cdHRvT2JqZWN0KCkge1xuXHRcdHJldHVybiB0aGlzLm1hc2s7XG5cdH1cblxuXHQvKipcblx0ICogQ29tYmluZXMgdHdvIG9yIG1vcmUgbWFza3Mgc3VjaCB0aGF0IHRoZSByZXN1bHQgbWFzayBtYXRjaGVzIGZpZWxkcyBtYXRjaGVkIGJ5XG5cdCAqIGFueSBvZiB0aGUgY29tYmluZWQgbWFza3MuXG5cdCAqXG5cdCAqIEBtZXRob2QgYWRkTWFza3Ncblx0ICogQHN0YXRpY1xuXHQgKiBAcGFyYW0ge09iamVjdE1hc2t8T2JqZWN0fSBtYXNrMVxuXHQgKiBAcGFyYW0ge09iamVjdE1hc2t8T2JqZWN0fSBtYXNrMi4uLlxuXHQgKiBAcmV0dXJuIHtPYmplY3RNYXNrfSAtIFRoZSByZXN1bHQgb2YgYWRkaW5nIHRvZ2V0aGVyIHRoZSBjb21wb25lbnQgbWFza3Ncblx0ICovXG5cdHN0YXRpYyBhZGRNYXNrcygpIHtcblx0XHRsZXQgcmVzdWx0TWFzayA9IGZhbHNlO1xuXG5cdFx0Ly8gQWRkcyBhIHNpbmdsZSBtYXNrIChmcm9tTWFzaykgaW50byB0aGUgcmVzdWx0TWFzayBtYXNrIGluLXBsYWNlLiAgdG9NYXNrIHNob3VsZCBiZSBhbiBvYmplY3QuXG5cdFx0Ly8gSWYgdGhlIHJlc3VsdGluZyBtYXNrIGlzIGEgYm9vbGVhbiB0cnVlLCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgdHJ1ZS4gIE90aGVyd2lzZSwgaXQgcmV0dXJucyB0b01hc2suXG5cdFx0ZnVuY3Rpb24gYWRkTWFzayhyZXN1bHRNYXNrLCBuZXdNYXNrKSB7XG5cdFx0XHRsZXQga2V5O1xuXG5cdFx0XHRpZiAocmVzdWx0TWFzayA9PT0gdHJ1ZSkgcmV0dXJuIHRydWU7XG5cdFx0XHRpZiAobmV3TWFzayA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRyZXN1bHRNYXNrID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdE1hc2s7XG5cdFx0XHR9XG5cdFx0XHRpZiAob2JqdG9vbHMuaXNTY2FsYXIobmV3TWFzaykpIHJldHVybiByZXN1bHRNYXNrO1xuXHRcdFx0aWYgKG9ianRvb2xzLmlzU2NhbGFyKHJlc3VsdE1hc2spKSB7XG5cdFx0XHRcdHJlc3VsdE1hc2sgPSBvYmp0b29scy5kZWVwQ29weShuZXdNYXNrKTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdE1hc2s7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KHJlc3VsdE1hc2spKSB7XG5cdFx0XHRcdHJlc3VsdE1hc2sgPSB7IF86IHJlc3VsdE1hc2tbMF0gfHwgZmFsc2UgfTtcblx0XHRcdH1cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KG5ld01hc2spKSB7XG5cdFx0XHRcdG5ld01hc2sgPSB7IF86IG5ld01hc2tbMF0gfHwgZmFsc2UgfTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgdGhlcmUgYXJlIGtleXMgdGhhdCBleGlzdCBpbiByZXN1bHQgYnV0IG5vdCBpbiB0aGUgbmV3TWFzayxcblx0XHRcdC8vIGFuZCB0aGUgcmVzdWx0IG1hc2sgaGFzIGEgXyBrZXkgKHdpbGRjYXJkKSwgY29tYmluZVxuXHRcdFx0Ly8gdGhlIHdpbGRjYXJkIG1hc2sgd2l0aCB0aGUgbmV3IG1hc2ssIGJlY2F1c2UgaW4gdGhlIGV4aXN0aW5nXG5cdFx0XHQvLyByZXN1bHQgbWFzaywgdGhhdCBrZXkgaGFzIHRoZSB3aWxkY2FyZCBwZXJtaXNzaW9uc1xuXHRcdFx0aWYgKG5ld01hc2suXyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGZvciAoa2V5IGluIHJlc3VsdE1hc2spIHtcblx0XHRcdFx0XHRpZiAoa2V5ID09PSAnXycpIGNvbnRpbnVlO1xuXHRcdFx0XHRcdGlmIChuZXdNYXNrW2tleV0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gYWRkTWFzayhyZXN1bHRNYXNrW2tleV0sIG5ld01hc2suXyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIHNhbWUgaGVyZSAuLi4gYWxzbywgY29weSBvdmVyIG9yIG1lcmdlIGZpZWxkc1xuXHRcdFx0Zm9yIChrZXkgaW4gbmV3TWFzaykge1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnXycpIGNvbnRpbnVlO1xuXHRcdFx0XHRpZiAocmVzdWx0TWFza1trZXldICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXN1bHRNYXNrW2tleV0gPSBhZGRNYXNrKHJlc3VsdE1hc2tba2V5XSwgbmV3TWFza1trZXldKTtcblx0XHRcdFx0fSBlbHNlIGlmIChyZXN1bHRNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGFkZE1hc2sob2JqdG9vbHMuZGVlcENvcHkobmV3TWFza1trZXldKSwgcmVzdWx0TWFzay5fKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHRNYXNrW2tleV0gPSBvYmp0b29scy5kZWVwQ29weShuZXdNYXNrW2tleV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBmaWxsIGluIHRoZSBfIGtleSB0aGF0IHdlIHNraXBwZWQgZWFybGllclxuXHRcdFx0aWYgKG5ld01hc2suXyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGlmIChyZXN1bHRNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJlc3VsdE1hc2suXyA9IGFkZE1hc2socmVzdWx0TWFzay5fLCBuZXdNYXNrLl8pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc3VsdE1hc2suXyA9IG9ianRvb2xzLmRlZXBDb3B5KG5ld01hc2suXyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgdGhlcmUgaXMgYSB3aWxkY2FyZCwgcmVtb3ZlIGFueSBrZXlzIHRoYXQgYXJlIHNldCB0byB0aGUgc2FtZSB0aGluZyBhcyB0aGUgd2lsZGNhcmRcblx0XHRcdC8vIFRoaXMgaXNuJ3Qgc3RyaWN0bHkgbmVjZXNzYXJ5LCBidXQgcmVtb3ZlcyByZWR1bmRhbnQgZGF0YVxuXHRcdFx0aWYgKHJlc3VsdE1hc2suXyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGZvciAoa2V5IGluIHJlc3VsdE1hc2spIHtcblx0XHRcdFx0XHRpZiAoa2V5ICE9PSAnXycgJiYgb2JqdG9vbHMuZGVlcEVxdWFscyhyZXN1bHRNYXNrW2tleV0sIHJlc3VsdE1hc2suXykpIHtcblx0XHRcdFx0XHRcdGRlbGV0ZSByZXN1bHRNYXNrW2tleV07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiByZXN1bHRNYXNrIHx8IGZhbHNlO1xuXHRcdH1cblxuXHRcdGxldCBjdXJBcmc7XG5cdFx0Zm9yIChsZXQgYXJnSWR4ID0gMDsgYXJnSWR4IDwgYXJndW1lbnRzLmxlbmd0aDsgYXJnSWR4KyspIHtcblx0XHRcdGN1ckFyZyA9IGFyZ3VtZW50c1thcmdJZHhdO1xuXHRcdFx0aWYgKGN1ckFyZyBpbnN0YW5jZW9mIE9iamVjdE1hc2spIHtcblx0XHRcdFx0Y3VyQXJnID0gY3VyQXJnLnRvT2JqZWN0KCk7XG5cdFx0XHR9XG5cdFx0XHRyZXN1bHRNYXNrID0gYWRkTWFzayhyZXN1bHRNYXNrLCBjdXJBcmcpO1xuXHRcdFx0aWYgKHJlc3VsdE1hc2sgPT09IHRydWUpIHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IE9iamVjdE1hc2socmVzdWx0TWFzayB8fCBmYWxzZSk7XG5cdH1cblxuXHQvKipcblx0ICogQWRkcyBhIHNldCBvZiBtYXNrcyB0b2dldGhlciwgYnV0IHVzaW5nIGEgbG9naWNhbCBBTkQgaW5zdGVhZCBvZiBhIGxvZ2ljYWwgT1IgKGFzIGluIGFkZE1hc2tzKS5cblx0ICogSUUsIGEgZmllbGQgbXVzdCBiZSBhbGxvd2VkIGluIGFsbCBnaXZlbiBtYXNrcyB0byBiZSBpbiB0aGUgcmVzdWx0IG1hc2suXG5cdCAqXG5cdCAqIEBtZXRob2QgYW5kTWFza3Ncblx0ICogQHN0YXRpY1xuXHQgKiBAcGFyYW0ge09iamVjdE1hc2t8T2JqZWN0fSBtYXNrMVxuXHQgKiBAcGFyYW0ge09iamVjdE1hc2t8T2JqZWN0fSBtYXNrMi4uLlxuXHQgKiBAcmV0dXJuIHtPYmplY3RNYXNrfSAtIFRoZSByZXN1bHQgb2YgQU5EaW5nIHRvZ2V0aGVyIHRoZSBjb21wb25lbnQgbWFza3Ncblx0ICovXG5cdHN0YXRpYyBhbmRNYXNrcygpIHtcblx0XHRsZXQgcmVzdWx0TWFzayA9IHRydWU7XG5cblx0XHRmdW5jdGlvbiBhbmRNYXNrKHJlc3VsdE1hc2ssIG5ld01hc2spIHtcblx0XHRcdGxldCBrZXk7XG5cblx0XHRcdC8vIERlZ2VuZXJhdGUgY2FzZXNcblx0XHRcdGlmIChyZXN1bHRNYXNrID09PSB0cnVlKSByZXR1cm4gb2JqdG9vbHMuZGVlcENvcHkobmV3TWFzayk7XG5cdFx0XHRpZiAobmV3TWFzayA9PT0gdHJ1ZSkgcmV0dXJuIHJlc3VsdE1hc2s7XG5cdFx0XHRpZiAob2JqdG9vbHMuaXNTY2FsYXIocmVzdWx0TWFzaykgfHwgb2JqdG9vbHMuaXNTY2FsYXIobmV3TWFzaykpIHJldHVybiBmYWxzZTtcblxuXHRcdFx0Ly8gUmVzb2x2ZSBhcnJheXNcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KHJlc3VsdE1hc2spKSB7XG5cdFx0XHRcdHJlc3VsdE1hc2sgPSB7IF86IHJlc3VsdE1hc2tbMF0gfHwgZmFsc2UgfTtcblx0XHRcdH1cblx0XHRcdGlmIChBcnJheS5pc0FycmF5KG5ld01hc2spKSB7XG5cdFx0XHRcdG5ld01hc2sgPSB7IF86IG5ld01hc2tbMF0gfHwgZmFsc2UgfTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSGFuZGxlIGtleXMgdGhhdCBleGlzdCBpbiBib3RoIG1hc2tzLCBleGNlcHRpbmcgX1xuXHRcdFx0Zm9yIChrZXkgaW4gbmV3TWFzaykge1xuXHRcdFx0XHRpZiAoa2V5ID09PSAnXycpIGNvbnRpbnVlO1xuXHRcdFx0XHRpZiAocmVzdWx0TWFza1trZXldICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXN1bHRNYXNrW2tleV0gPSBhbmRNYXNrKHJlc3VsdE1hc2tba2V5XSwgbmV3TWFza1trZXldKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBIYW5kbGUga2V5cyB0aGF0IGV4aXN0IGluIHJlc3VsdE1hc2sgYnV0IG5vdCBpbiBuZXdNYXNrXG5cdFx0XHRmb3IgKGtleSBpbiByZXN1bHRNYXNrKSB7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdfJykgY29udGludWU7XG5cdFx0XHRcdGlmIChuZXdNYXNrW2tleV0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGlmIChuZXdNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gYW5kTWFzayhyZXN1bHRNYXNrW2tleV0sIG5ld01hc2suXyk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJlc3VsdE1hc2tba2V5XSA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBIYW5kbGUga2V5cyB0aGF0IGV4aXN0IGluIG5ld01hc2sgYnV0IG5vdCByZXN1bHRNYXNrXG5cdFx0XHRmb3IgKGtleSBpbiBuZXdNYXNrKSB7XG5cdFx0XHRcdGlmIChrZXkgPT09ICdfJykgY29udGludWU7XG5cdFx0XHRcdGlmIChyZXN1bHRNYXNrW2tleV0gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGlmIChyZXN1bHRNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0cmVzdWx0TWFza1trZXldID0gYW5kTWFzayhvYmp0b29scy5kZWVwQ29weShuZXdNYXNrW2tleV0pLCByZXN1bHRNYXNrLl8pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXN1bHRNYXNrW2tleV0gPSBmYWxzZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSGFuZGxlIF8gKHdpbGRjYXJkIGZpZWxkcylcblx0XHRcdGlmIChuZXdNYXNrLl8gIT09IHVuZGVmaW5lZCAmJiByZXN1bHRNYXNrLl8gIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRyZXN1bHRNYXNrLl8gPSBhbmRNYXNrKHJlc3VsdE1hc2suXywgbmV3TWFzay5fKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRlbGV0ZSByZXN1bHRNYXNrLl87XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRvIGNvbmRlbnNlIHNvbWUgY2FzZXMsIHJlbW92ZSB1bm5lY2Vzc2FyeSBmYWxzeSB2YWx1ZXNcblx0XHRcdGlmICghcmVzdWx0TWFzay5fKSB7XG5cdFx0XHRcdGRlbGV0ZSByZXN1bHRNYXNrLl87XG5cdFx0XHRcdC8vIFNpbmNlIGFsbCB2YWx1ZXMgd2lsbCBkZWZhdWx0IHRvIGZhbHNlLCB3ZSBjYW4gcmVtb3ZlIGFueSBmYWxzeSB2YWx1ZXNcblx0XHRcdFx0Zm9yIChrZXkgaW4gcmVzdWx0TWFzaykge1xuXHRcdFx0XHRcdGlmICghcmVzdWx0TWFza1trZXldKSB7XG5cdFx0XHRcdFx0XHRkZWxldGUgcmVzdWx0TWFza1trZXldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJZiB0aGVyZSBhcmUgbm8ga2V5cyBsZWZ0IGluIHJlc3VsdE1hc2ssIGNvbmRlbnNlIHRvIGZhbHNlXG5cdFx0XHRpZiAoIU9iamVjdC5rZXlzKHJlc3VsdE1hc2spLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG5cdFx0XHRyZXR1cm4gcmVzdWx0TWFzaztcblx0XHR9XG5cblx0XHRsZXQgY3VyQXJnO1xuXHRcdGZvciAobGV0IGFyZ0lkeCA9IDA7IGFyZ0lkeCA8IGFyZ3VtZW50cy5sZW5ndGg7IGFyZ0lkeCsrKSB7XG5cdFx0XHRjdXJBcmcgPSBhcmd1bWVudHNbYXJnSWR4XTtcblx0XHRcdGlmIChjdXJBcmcgaW5zdGFuY2VvZiBPYmplY3RNYXNrKSB7XG5cdFx0XHRcdGN1ckFyZyA9IGN1ckFyZy50b09iamVjdCgpO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0TWFzayA9IGFuZE1hc2socmVzdWx0TWFzaywgY3VyQXJnKTtcblx0XHRcdGlmIChyZXN1bHRNYXNrID09PSBmYWxzZSkgcmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IE9iamVjdE1hc2socmVzdWx0TWFzayB8fCBmYWxzZSk7XG5cdH1cblxuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiBhIG1hc2sgaXMgdmFsaWQgaW4gc3RyaWN0IGZvcm0gKGllLCBpdCBvbmx5IGNvbnRhaW5zIG9iamVjdHMgYW5kIGJvb2xlYW5zKVxuXHQgKlxuXHQgKiBAbWV0aG9kIHZhbGlkYXRlXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59IC0gV2hldGhlciBvciBub3QgdGhlIG1hc2sgaXMgc3RyaWN0bHkgdmFsaWRcblx0ICovXG5cdHZhbGlkYXRlKCkge1xuXHRcdGZ1bmN0aW9uIHZhbFdoaXRlbGlzdCh3aGl0ZWxpc3QpIHtcblx0XHRcdGlmICh3aGl0ZWxpc3QgIT09IHRydWUgJiYgd2hpdGVsaXN0ICE9PSBmYWxzZSAmJiBvYmp0b29scy5pc1NjYWxhcih3aGl0ZWxpc3QpKSByZXR1cm4gZmFsc2U7XG5cdFx0XHRpZiAodHlwZW9mIHdoaXRlbGlzdCA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0Zm9yIChsZXQga2V5IGluIHdoaXRlbGlzdCkge1xuXHRcdFx0XHRcdGlmICghdmFsV2hpdGVsaXN0KHdoaXRlbGlzdFtrZXldKSkgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbFdoaXRlbGlzdCh0aGlzLm1hc2spO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYW4gYXJyYXkgb2YgZmllbGRzIGluIHRoZSBnaXZlbiBvYmplY3Qgd2hpY2ggYXJlIHJlc3RyaWN0ZWQgYnkgdGhlIGdpdmVuIG1hc2tcblx0ICpcblx0ICogQG1ldGhvZCBnZXRNYXNrZWRPdXRGaWVsZHNcblx0ICogQHBhcmFtIHtPYmplY3R9IG9iaiAtIFRoZSBvYmplY3QgdG8gY2hlY2sgYWdhaW5zdFxuXHQgKiBAcmV0dXJuIHtTdHJpbmdbXX0gLSBQYXRocyB0byBmaWVsZHMgdGhhdCBhcmUgcmVzdHJpY3RlZCBieSB0aGUgbWFza1xuXHQgKi9cblx0Z2V0TWFza2VkT3V0RmllbGRzKG9iaikge1xuXHRcdGxldCBtYXNrZWRPdXQgPSBbXTtcblx0XHR0aGlzLmZpbHRlck9iamVjdChvYmosIGZ1bmN0aW9uKHBhdGgpIHtcblx0XHRcdG1hc2tlZE91dC5wdXNoKHBhdGgpO1xuXHRcdH0pO1xuXHRcdHJldHVybiBtYXNrZWRPdXQ7XG5cdH1cblxuXHQvKipcblx0ICogR2l2ZW4gYSBkb3Qtbm90YXRpb24gbWFwcGluZyBmcm9tIGZpZWxkcyB0byB2YWx1ZXMsIHJlbW92ZSBhbGwgZmllbGRzIHRoYXQgYXJlIG5vdFxuXHQgKiBhbGxvd2VkIGJ5IHRoZSBtYXNrLlxuXHQgKlxuXHQgKiBAbWV0aG9kIGZpbHRlckRvdHRlZE9iamVjdFxuXHQgKiBAcGFyYW0ge09iamVjdH0gZG90dGVkT2JqIC0gTWFwIGZyb20gZG90dGVkIHBhdGhzIHRvIHZhbHVlcywgc3VjaCBhcyB7IFwiZm9vLmJhclwiOiBcImJhelwiIH1cblx0ICogQHBhcmFtIHtGdW5jdGlvbn0gW21hc2tlZE91dEhvb2tdIC0gRnVuY3Rpb24gdG8gY2FsbCBmb3IgcmVtb3ZlZCBmaWVsZHNcblx0ICogQHBhcmFtIHtTdHJpbmd9IG1hc2tlZE91dEhvb2sucGF0aCAtIFBhdGggb2YgdGhlIG1hc2tlZCBvdXQgZmllbGRcblx0ICogQHJldHVybiB7T2JqZWN0fSAtIFRoZSByZXN1bHRcblx0ICovXG5cdGZpbHRlckRvdHRlZE9iamVjdChkb3R0ZWRPYmosIG1hc2tlZE91dEhvb2spIHtcblx0XHRsZXQgcmVzdWx0T2JqID0ge307XG5cdFx0Zm9yIChsZXQga2V5IGluIGRvdHRlZE9iaikge1xuXHRcdFx0aWYgKCF0aGlzLmNoZWNrUGF0aChrZXkpKSB7XG5cdFx0XHRcdGlmIChtYXNrZWRPdXRIb29rKSB7XG5cdFx0XHRcdFx0bWFza2VkT3V0SG9vayhrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHRPYmpba2V5XSA9IGRvdHRlZE9ialtrZXldO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0T2JqO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYW4gYXJyYXkgb2YgZmllbGRzIGluIHRoZSBnaXZlbiBvYmplY3Qgd2hpY2ggYXJlIHJlc3RyaWN0ZWQgYnkgdGhlIGdpdmVuIG1hc2suICBUaGVcblx0ICogb2JqZWN0IGlzIGluIGRvdHRlZCBub3RhdGlvbiBhcyBpbiBmaWx0ZXJEb3R0ZWRPYmplY3QoKVxuXHQgKlxuXHQgKiBAbWV0aG9kIGdldERvdHRlZE1hc2tlZE91dEZpZWxkc1xuXHQgKiBAcGFyYW0ge09iamVjdH0gb2JqIC0gVGhlIG9iamVjdCB0byBjaGVjayBhZ2FpbnN0XG5cdCAqIEByZXR1cm4ge1N0cmluZ1tdfSAtIFBhdGhzIHRvIGZpZWxkcyB0aGF0IGFyZSByZXN0cmljdGVkIGJ5IHRoZSBtYXNrXG5cdCAqL1xuXHRnZXREb3R0ZWRNYXNrZWRPdXRGaWVsZHMob2JqKSB7XG5cdFx0bGV0IG1hc2tlZE91dCA9IFtdO1xuXHRcdHRoaXMuZmlsdGVyRG90dGVkT2JqZWN0KG9iaiwgZnVuY3Rpb24ocGF0aCkge1xuXHRcdFx0bWFza2VkT3V0LnB1c2gocGF0aCk7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIG1hc2tlZE91dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhIHN0cnVjdHVyZWQgZG9jdW1lbnQsIGVuc3VyZXMgdGhhdFxuXHQgKiBhbGwgZmllbGRzIGFyZSBhbGxvd2VkIGJ5IHRoZSBnaXZlbiBtYXNrLiAgUmV0dXJucyB0cnVlIG9yIGZhbHNlLlxuXHQgKlxuXHQgKiBAbWV0aG9kIGNoZWNrRmllbGRzXG5cdCAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcblx0ICogQHJldHVybiB7Qm9vbGVhbn1cblx0ICovXG5cdGNoZWNrRmllbGRzKG9iaikge1xuXHRcdHJldHVybiB0aGlzLmdldE1hc2tlZE91dEZpZWxkcyhvYmopLmxlbmd0aCA9PT0gMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHaXZlbiBhIGRvdC1ub3RhdGlvbiBtYXBwaW5nIGZyb20gZmllbGRzIHRvIHZhbHVlcyAob25seSAxIGxldmVsIGRlZXAgaXMgY2hlY2tlZCksXG5cdCAqIGVuc3VyZSB0aGF0IGFsbCBmaWVsZHMgYXJlIGluIHRoZSAoc3RydWN0dXJlZCkgbWFzay5cblx0ICpcblx0ICogQG1ldGhvZCBjaGVja0RvdHRlZEZpZWxkc1xuXHQgKiBAcGFyYW0ge09iamVjdH0gZG90dGVkT2JqIC0gTWFwcGluZyBmcm9tIGRvdC1zZXBhcmF0ZWQgcGF0aHMgdG8gdmFsdWVzXG5cdCAqIEByZXR1cm4ge0Jvb2xlYW59XG5cdCAqL1xuXHRjaGVja0RvdHRlZEZpZWxkcyhkb3R0ZWRPYmopIHtcblx0XHRsZXQgc2VsZiA9IHRoaXM7XG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKGRvdHRlZE9iaikuZXZlcnkoZnVuY3Rpb24ocGF0aCkge1xuXHRcdFx0cmV0dXJuIHNlbGYuY2hlY2tQYXRoKHBhdGgpO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBzdHJ1Y3R1cmVkIG1hc2sgZ2l2ZW4gYSBsaXN0IG9mIGZpZWxkcyB0aGF0IHNob3VsZCBiZSBpbmNsdWRlZCBpbiB0aGUgbWFzay5cblx0ICpcblx0ICogQG1ldGhvZCBjcmVhdGVNYXNrRnJvbUZpZWxkTGlzdFxuXHQgKiBAc3RhdGljXG5cdCAqIEBwYXJhbSB7U3RyaW5nW119IGZpZWxkcyAtIEFycmF5IG9mIGZpZWxkcyB0byBpbmNsdWRlXG5cdCAqIEByZXR1cm4ge09iamVjdE1hc2t9IC0gVGhlIGNyZWF0ZWQgbWFza1xuXHQgKi9cblx0c3RhdGljIGNyZWF0ZU1hc2tGcm9tRmllbGRMaXN0KGZpZWxkcykge1xuXHRcdGxldCByZXQgPSB7fTtcblx0XHQvLyBXZSBzb3J0IGZpZWxkcyBieSBsZW5ndGgsIGxvbmcgdG8gc2hvcnQsIHRvIGF2b2lkIG1vcmUgc3BlY2lmaWMgZmllbGRzIGNsb2JiZXJpbmdcblx0XHQvLyBsZXNzIHNwZWNpZmljIGZpZWxkcy5cblx0XHRmaWVsZHMgPSBmaWVsZHMuc2xpY2UoMCkuc29ydChmdW5jdGlvbihhLCBiKSB7XG5cdFx0XHRyZXR1cm4gYi5sZW5ndGggLSBhLmxlbmd0aDtcblx0XHR9KTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGZpZWxkcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0b2JqdG9vbHMuc2V0UGF0aChyZXQsIGZpZWxkc1tpXSwgdHJ1ZSk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgT2JqZWN0TWFzayhyZXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGZpbHRlcnMgb2JqZWN0IGZpZWxkcyBiYXNlZCBvbiBhIHN0cnVjdHVyZWQgbWFzay93aGl0ZWxpc3QuXG5cdCAqXG5cdCAqIEBtZXRob2QgY3JlYXRlRmlsdGVyRnVuY1xuXHQgKiBAc3RhdGljXG5cdCAqIEByZXR1cm4ge0Z1bmN0aW9ufSAtIEEgZnVuY3Rpb24ob2JqKSB0aGF0IGlzIHRoZSBlcXVpdmFsZW50IG9mIGNhbGxpbmcgZmlsdGVyT2JqZWN0KClcblx0ICogb24gb2JqXG5cdCAqL1xuXHRjcmVhdGVGaWx0ZXJGdW5jKCkge1xuXHRcdGxldCBtYXNrID0gdGhpcztcblx0XHRyZXR1cm4gZnVuY3Rpb24ob2JqKSB7XG5cdFx0XHRyZXR1cm4gbWFzay5maWx0ZXJPYmplY3Qob2JqKTtcblx0XHR9O1xuXHR9XG5cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBPYmplY3RNYXNrO1xuIl19