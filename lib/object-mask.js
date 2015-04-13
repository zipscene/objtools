let objtools = require('./index');
let XError = require('xerror');
let _ = require('lodash');

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
class ObjectMask {

	constructor(mask) {
		this.mask = underscorizeArrays(_.cloneDeep(mask));
	}

	/**
	 * Creates a structured mask given a list of fields that should be included in the mask.
	 *
	 * @method createMaskFromFieldList
	 * @static
	 * @param {String[]} fields - Array of fields to include
	 * @return {ObjectMask} - The created mask
	 */
	static createMaskFromFieldList(fields) {
		let ret = {};
		// We sort fields by length, long to short, to avoid more specific fields clobbering
		// less specific fields.
		fields = fields.slice(0).sort(function(a, b) {
			return b.length - a.length;
		});
		for (let field of fields) {
			objtools.setPath(ret, field, true);
		}
		return new ObjectMask(ret);
	}

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
	static addMasks() {
		let resultMask = false;

		// Adds a single mask (fromMask) into the resultMask mask in-place.  toMask should be an object.
		// If the resulting mask is a boolean true, this function returns true.  Otherwise, it returns toMask.
		function addMask(resultMask, newMask) {
			let key;

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
					if (key === '_') continue;
					if (newMask[key] === undefined) {
						resultMask[key] = addMask(resultMask[key], newMask._);
					}
				}
			}

			// same here ... also, copy over or merge fields
			for (key in newMask) {
				if (key === '_') continue;
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
					if (key !== '_' && objtools.deepEquals(resultMask[key], resultMask._)) {
						delete resultMask[key];
					}
				}
			}

			return resultMask || false;
		}

		let curArg;
		for (let argIdx = 0; argIdx < arguments.length; argIdx++) {
			curArg = arguments[argIdx];
			if (curArg instanceof ObjectMask) {
				curArg = curArg.toObject();
			}
			resultMask = addMask(resultMask, curArg);
			if (resultMask === true) return true;
		}
		return new ObjectMask(resultMask || false);
	}

	/**
	 *	Inverts a mask. The resulting mask disallows all fields previously allowed, and allows all
	 *		fields previously disallowed.
	 *	@static
	 *	@param {ObjectMask} - the mask to invert
	 *	@returns {ObjectMask} - the inverted mask
	 */
	static invertMask(mask) {
		if (mask instanceof ObjectMask) mask = mask.mask;
		return new ObjectMask(invert(mask));
	}

	/**
	 * Subtracts a mask
	 *
	 * @method
	 * @param {ObjectMask|Object} mask - the mask to subtract
	 * @return {ObjectMask} - returns this
	 */
	subtractMask(mask) {
		subtract(this.mask, mask instanceof ObjectMask ? mask.mask : mask);
		return this;
	}

	/**
	 * Adds a field to a filter. If the filter already matches, the method is a no-op.
	 *
	 * @method addField
	 * @param {String} path - the dotted path to the field to add
	 * @return {Object} - returns self
	 */
	addField(path) {
		if (!this.checkFields(objtools.setPath({}, path, true))) {
			objtools.setPath(this.mask, path, true);
		}
		return this;
	}

	/**
	 * Removes a field from a filter. If the mask already does not match, the method is a no-op.
	 * Does not handle array-type wildcards, which are removed on instantiation
	 *
	 * @method removeField
	 * @param {String} path - the dotted path to the field to remove
	 * @throws {XError} on attempt to remove wildcard
	 * @return {Object} - returns self
	 */
	removeField(path) {
		if (path === '_' || path.slice(-2) === '._') {
			throw new XError(XError.INVALID_ARGUMENT, 'Attempt to remove wildcard');
		} else if (this.checkFields(objtools.setPath({}, path, true))) {
			let submask = this.mask;
			let subpaths = path.split('.');
			while (submask) {
				let wildcardSubmask = submask._ || submask[0];
				let nextSubpath = subpaths.shift();
				let nextSubmask = submask[nextSubpath];
				if (typeof nextSubmask === 'object') {
					submask = nextSubmask;
				} else if (wildcardSubmask && !nextSubmask) {
					submask = submask[nextSubpath] = _.cloneDeep(wildcardSubmask);
				} else {
					while (subpaths.length) {
						submask = submask[nextSubpath] = { _: true };
						nextSubpath = subpaths.shift();
					}
					submask = submask[nextSubpath] = false;
				}
			}
		}
		return this;
	}

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
	filterObject(obj, maskedOutHook) {
		let mask = this.mask;
		function filter(obj, mask, path) {
			if (mask === true) return obj;
			if (!mask || objtools.isScalar(obj)) {
				if (maskedOutHook) maskedOutHook(path);
				return undefined;
			}
			if (Array.isArray(mask)) {
				mask = { _: mask[0] || false };
			}
			if (typeof mask === 'object') {
				let resultIsArray = Array.isArray(obj);
				let resultObj = resultIsArray ? [] : {};
				let maskVal, resultVal;
				for (let key in obj) {
					maskVal = (mask[key] === undefined) ? mask._ : mask[key];
					resultVal = filter(obj[key], maskVal || false, path ? (path + '.' + key) : key);
					if (resultVal !== undefined) {
						if (resultIsArray) resultObj.push(resultVal);
						else resultObj[key] = resultVal;
					}
				}
				return resultObj;
			} else {
				if (maskedOutHook) maskedOutHook(path);
				return undefined;
			}
		}
		return filter(obj, mask, '');
	}

	/**
	 * Returns a subsection of a mask given a dot-separated path to the subsection.
	 *
	 * @method getSubMask
	 * @param {String} path - Dot-separated path to submask to fetch
	 * @return {ObjectMask} - Mask component corresponding to the path
	 */
	getSubMask(path) {
		let mask = this.mask;
		let parts = path.split('.');
		let cur = mask;
		for (let partIdx = 0; partIdx < parts.length; partIdx++) {
			if (cur === true) return true;
			if (objtools.isScalar(cur)) return false;
			if (Array.isArray(cur)) cur = { _: cur[0] || false };
			let part = parts[partIdx];
			cur = (cur[part] === undefined) ? cur._ : cur[part];
		}
		return new ObjectMask(cur || false);
	}

	/**
	 * Returns true if the given path is allowed by the mask.  false otherwise.
	 *
	 * @method checkMaskPath
	 * @param {String} path - Dot-separated path
	 * @return {Boolean} - Whether or not the given path is allowed
	 */
	checkPath(path) {
		return this.getSubMask(path).mask === true;
	}

	/**
	 * Returns the internal object that represents this mask.
	 *
	 * @method toObject
	 * @return {Object} - Object representation of this mask
	 */
	toObject() {
		return this.mask;
	}

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
	static andMasks() {
		let resultMask = true;

		function andMask(resultMask, newMask) {
			let key;

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
				if (key === '_') continue;
				if (resultMask[key] !== undefined) {
					resultMask[key] = andMask(resultMask[key], newMask[key]);
				}
			}

			// Handle keys that exist in resultMask but not in newMask
			for (key in resultMask) {
				if (key === '_') continue;
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
				if (key === '_') continue;
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
			if (!Object.keys(resultMask).length) return false;

			return resultMask;
		}

		let curArg;
		for (let argIdx = 0; argIdx < arguments.length; argIdx++) {
			curArg = arguments[argIdx];
			if (curArg instanceof ObjectMask) {
				curArg = curArg.toObject();
			}
			resultMask = andMask(resultMask, curArg);
			if (resultMask === false) return false;
		}
		return new ObjectMask(resultMask || false);
	}


	/**
	 * Check if a mask is valid in strict form (ie, it only contains objects and booleans)
	 *
	 * @method validate
	 * @return {Boolean} - Whether or not the mask is strictly valid
	 */
	validate() {
		function valWhitelist(whitelist) {
			if (whitelist !== true && whitelist !== false && objtools.isScalar(whitelist)) return false;
			if (typeof whitelist === 'object') {
				for (let key in whitelist) {
					if (!valWhitelist(whitelist[key])) return false;
				}
			}
			return true;
		}
		return valWhitelist(this.mask);
	}

	/**
	 * Returns an array of fields in the given object which are restricted by the given mask
	 *
	 * @method getMaskedOutFields
	 * @param {Object} obj - The object to check against
	 * @return {String[]} - Paths to fields that are restricted by the mask
	 */
	getMaskedOutFields(obj) {
		let maskedOut = [];
		this.filterObject(obj, function(path) {
			maskedOut.push(path);
		});
		return maskedOut;
	}

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
	filterDottedObject(dottedObj, maskedOutHook) {
		let resultObj = {};
		for (let key in dottedObj) {
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

	/**
	 * Returns an array of fields in the given object which are restricted by the given mask.  The
	 * object is in dotted notation as in filterDottedObject()
	 *
	 * @method getDottedMaskedOutFields
	 * @param {Object} obj - The object to check against
	 * @return {String[]} - Paths to fields that are restricted by the mask
	 */
	getDottedMaskedOutFields(obj) {
		let maskedOut = [];
		this.filterDottedObject(obj, function(path) {
			maskedOut.push(path);
		});
		return maskedOut;
	}

	/**
	 * Given a structured document, ensures that
	 * all fields are allowed by the given mask.  Returns true or false.
	 *
	 * @method checkFields
	 * @param {Object} obj
	 * @return {Boolean}
	 */
	checkFields(obj) {
		return this.getMaskedOutFields(obj).length === 0;
	}

	/**
	 * Given a dot-notation mapping from fields to values (only 1 level deep is checked),
	 * ensure that all fields are in the (structured) mask.
	 *
	 * @method checkDottedFields
	 * @param {Object} dottedObj - Mapping from dot-separated paths to values
	 * @return {Boolean}
	 */
	checkDottedFields(dottedObj) {
		let self = this;
		return Object.keys(dottedObj).every(function(path) {
			return self.checkPath(path);
		});
	}

	/**
	 * Returns a function that filters object fields based on a structured mask/whitelist.
	 *
	 * @method createFilterFunc
	 * @static
	 * @return {Function} - A function(obj) that is the equivalent of calling filterObject()
	 * on obj
	 */
	createFilterFunc() {
		let mask = this;
		return function(obj) {
			return mask.filterObject(obj);
		};
	}

}

function underscorizeArrays(mask) {
	for (let subpath in mask) {
		let submask = mask[subpath];
		if (_.isArray(submask)) {
			mask[subpath] = { _: underscorizeArrays(submask[0]) };
		} else if (_.isObject(submask)) {
			mask[subpath] = underscorizeArrays(submask);
		}
	}
	return mask;
}

function invert(mask) {
	if (objtools.isScalar(mask)) return !mask;
	let result = {};
	for (let key in mask) {
		result[key] = invert(mask[key]);
	}
	if (result._ === undefined) {
		result._ = true;
	} else if (!result._) {
		delete result._;
	}
	return result;
}

function subtract(a, b) {
	let key;
	if (b === true || !a || _.isEqual(a, b)) return false;
	if (!objtools.isScalar(a) && '_' in a) {
		if (!objtools.isScalar(b) && '_' in b) {
			// both have _
			if (a._ === true && !objtools.isScalar(b._)) a._ = subtract({ _: true }, b._);
			if (a._ === false) delete a._;
			for (key in b) {
				if (key !== '_') a._[key] = subtract(a[key], b[key]);
			}
		} else {
			// only a has _
			for (key in b) {
				a[key] = subtract(a[key], b[key]);
			}
		}
	} else {
		if (!objtools.isScalar(b) && '_' in b) {
			// only b has _
			for (key in a) {
				if (!(key in b)) delete a[key];
			}
			for (key in b) {
				if (key !== '_') a[key] = subtract(a[key], b[key]);
			}
		} else {
			// neither has _
			for (key in b) {
				if (objtools.isScalar(b[key])) {
					if (key in a) delete a[key];
				} else if (key in a && objtools.isScalar(a[key])) {
					a[key] = invert(b[key]);
				} else if (key in a) {
					a[key] = subtract(a[key], b[key]);
				}
			}
		}
	}

	if (a._ === undefined) {
		for (key in a) {
			if (a[key] === false) delete a[key];
		}
	}
	if (_.isEqual(a, {})) return false;
	return a;
}

module.exports = ObjectMask;
