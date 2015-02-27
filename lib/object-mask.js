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
ObjectMask.prototype.filterObject = function(obj, maskedOutHook) {
	var mask = this.mask;
	function filter(obj, mask, path) {
		if(mask === true) return obj;
		if(!mask || isScalar(obj)) {
			if(maskedOutHook) maskedOutHook(path);
			return undefined;
		}
		if(Array.isArray(mask)) {
			mask = { _: mask[0] || false };
		}
		if(typeof mask == 'object') {
			var resultIsArray = Array.isArray(obj);
			var resultObj = resultIsArray ? [] : {};
			var maskVal, resultVal;
			for(var key in obj) {
				maskVal = (mask[key] === undefined) ? mask._ : mask[key];
				resultVal = filter(obj[key], maskVal || false, path ? (path + '.' + key) : key);
				if(resultVal !== undefined) {
					if(resultIsArray) resultObj.push(resultVal);
					else resultObj[key] = resultVal;
				}
			}
			return resultObj;
		} else {
			if(maskedOutHook) maskedOutHook(path);
			return undefined;
		}
	}
	return filter(obj, mask, '');
};

/**
 * Returns a subsection of a mask given a dot-separated path to the subsection.
 *
 * @method getSubMask
 * @param {String} path - Dot-separated path to submask to fetch
 * @return {Boolean|Object} - Mask component corresponding to the path
 */
ObjectMask.prototype.getSubMask = function(path) {
	var mask = this.mask;
	var parts = path.split('.');
	var cur = mask;
	for(var partIdx = 0; partIdx < parts.length; partIdx++) {
		if(cur === true) return true;
		if(isScalar(cur)) return false;
		if(Array.isArray(cur)) cur = { _: cur[0] || false };
		var part = parts[partIdx];
		cur = (cur[part] === undefined) ? cur._ : cur[part];
	}
	return cur || false;
};

/**
 * Returns true if the given path is allowed by the mask.  false otherwise.
 *
 * @method checkMaskPath
 * @param {String} path - Dot-separated path
 * @return {Boolean} - Whether or not the given path is allowed
 */
ObjectMask.prototype.checkPath = function(path) {
	return this.getSubMask(path) === true;
}

/**
 * Returns the internal object that represents this mask.
 *
 * @method toObject
 * @return {Object} - Object representation of this mask
 */
ObjectMask.prototype.toObject = function() {
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
ObjectMask.addMasks = function() {
	var resultMask = false;

	// Adds a single mask (fromMask) into the resultMask mask in-place.  toMask should be an object.
	// If the resulting mask is a boolean true, this function returns true.  Otherwise, it returns toMask.
	function addMask(resultMask, newMask) {
		var key;

		if(resultMask === true) return true;
		if(newMask === true) {
			resultMask = true;
			return resultMask;
		}
		if(isScalar(newMask)) return resultMask;
		if(isScalar(resultMask)) {
			resultMask = deepCopy(newMask);
			return resultMask;
		}

		if(Array.isArray(resultMask)) {
			resultMask = { _: resultMask[0] || false };
		}
		if(Array.isArray(newMask)) {
			newMask = { _: newMask[0] || false };
		}

		// If there are keys that exist in result but not in the newMask, and the result mask has a _ key (wildcard), combine
		// the wildcard mask with the new mask, because in the existing result mask, that key has the wildcard permissions
		if(newMask._ !== undefined) {
			for(key in resultMask) {
				if(key === '_') continue;
				if(newMask[key] === undefined) {
					resultMask[key] = addMask(resultMask[key], newMask._);
				}
			}
		}

		// same here ... also, copy over or merge fields
		for(key in newMask) {
			if(key === '_') continue;
			if(resultMask[key] !== undefined) {
				resultMask[key] = addMask(resultMask[key], newMask[key]);
			} else if(resultMask._ !== undefined) {
				resultMask[key] = addMask(deepCopy(newMask[key]), resultMask._);
			} else {
				resultMask[key] = deepCopy(newMask[key]);
			}
		}
		// fill in the _ key that we skipped earlier
		if(newMask._ !== undefined) {
			if(resultMask._ !== undefined) resultMask._ = addMask(resultMask._, newMask._);
			else resultMask._ = deepCopy(newMask._);
		}

		return resultMask || false;
	}

	var curArg;
	for(var argIdx = 0; argIdx < arguments.length; argIdx++) {
		curArg = arguments[argIdx];
		if(curArg instanceof ObjectMask) {
			curArg = curArg.toObject();
		}
		resultMask = addMask(resultMask, curArg);
		if(resultMask === true) return true;
	}
	return new ObjectMask(resultMask || false);
}
