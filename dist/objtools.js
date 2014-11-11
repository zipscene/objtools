/** objtools.js - v0.0.16 - Tue, 11 Nov 2014 20:52:21 GMT */
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),(o.ZSModule||(o.ZSModule={})).objtools=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"objtools":[function(_dereq_,module,exports){

function isScalar(o) {
	return typeof o != 'object' || (o instanceof Date) || !o;
}
exports.isScalar = isScalar;

function scalarEquals(a1, a2) {
	if(a1 instanceof Date && a2 instanceof Date) return a1.getTime() == a2.getTime();
	return a1 == a2;
}
exports.scalarEquals = scalarEquals;

/**
 * Note about whitelists/filters/masks:
 * Filters are objects that represent a subset of fields in an object to allow.  The simplest
 * filters are mapping from field names to a boolean 'true':
 * { foo: true, bar: true }
 * Nested fields can also be represented:
 * { foo: true, bar: { baz: true} }
 * In the case where a parent object matches a 'true', all sub-fields are allowed.  Wildcards
 * can also be used:
 * { foo: false, bar: false, _: true }
 * will allow all fields but foo and bar.
 * Arrays are equivalent to wildcards:
 * { foo: [ { bar: true, baz: true } ] }
 * is equivalent to
 * { foo: { _: { bar: true, baz: true } } }
 */

/**
 * Returns a copy of the given object, but only including the fields allowed by
 * the given mask.  If the maskedOutHook function is provided, it is called for
 * each field disallowed by the mask (at the highest level it is disallowed).
 */
function filterObjByMask(obj, mask, maskedOutHook) {
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
}
exports.filterObj = filterObjByMask;	// old, compatibility
exports.whitelistFilterDocument = filterObjByMask;	// old, compatibility
exports.filterObjByMask = filterObjByMask;

/**
 * Returns a subsection of a mask given a dot-separated path to the subsection.
 */
function getSubMask(mask, path) {
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
}
exports.getSubMask = getSubMask;

/**
 * Returns true if the given path is allowed by the mask.  false otherwise.
 */
function checkMaskPath(mask, path) {
	return getSubMask(mask, path) === true;
}
exports.checkMaskPath = checkMaskPath;

function addMasks() {
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

	for(var argIdx = 0; argIdx < arguments.length; argIdx++) {
		resultMask = addMask(resultMask, arguments[argIdx]);
		if(resultMask === true) return true;
	}
	return resultMask || false;
}
exports.combineWhitelists = addMasks;	// old, compatibility
exports.addObjFilters = addMasks;	// old, compatibility
exports.addMasks = addMasks;


function deepCopy(obj) {
	if(isScalar(obj)) return obj;
	var res;
	if(Array.isArray(obj)) {
		res = [];
		for(var i = 0; i < obj.length; i++) {
			res.push(deepCopy(obj[i]));
		}
	} else {
		res = {};
		for(var key in obj) {
			res[key] = deepCopy(obj[key]);
		}
	}
	return res;
}
exports.deepCopy = deepCopy;


// Adds a set of masks together, but using a logical AND instead of a logical OR
// IE, a field must be allowed in all given masks to be in the result mask
function andMasks() {
	var resultMask = true;

	function andMask(resultMask, newMask) {
		var key;

		// Degenerate cases
		if(resultMask === true) return deepCopy(newMask);
		if(newMask === true) return resultMask;
		if(isScalar(resultMask) || isScalar(newMask)) return false;

		// Resolve arrays
		if(Array.isArray(resultMask)) {
			resultMask = { _: resultMask[0] || false };
		}
		if(Array.isArray(newMask)) {
			newMask = { _: newMask[0] || false };
		}

		// Handle keys that exist in both masks, excepting _
		for(key in newMask) {
			if(key === '_') continue;
			if(resultMask[key] !== undefined) {
				resultMask[key] = andMask(resultMask[key], newMask[key]);
			}
		}

		// Handle keys that exist in resultMask but not in newMask
		for(key in resultMask) {
			if(key === '_') continue;
			if(newMask[key] === undefined) {
				if(newMask._ !== undefined) {
					resultMask[key] = andMask(resultMask[key], newMask._);
				} else {
					resultMask[key] = false;
				}
			}
		}

		// Handle keys that exist in newMask but not resultMask
		for(key in newMask) {
			if(key === '_') continue;
			if(resultMask[key] === undefined) {
				if(resultMask._ !== undefined) {
					resultMask[key] = andMask(deepCopy(newMask[key]), resultMask._);
				} else {
					resultMask[key] = false;
				}
			}
		}

		// Handle _ (wildcard fields)
		if(newMask._ !== undefined && resultMask._ !== undefined) {
			resultMask._ = andMask(resultMask._, newMask._);
		} else {
			delete resultMask._;
		}

		// To condense some cases, remove unnecessary falsy values
		if(!resultMask._) {
			delete resultMask._;
			// Since all values will default to false, we can remove any falsy values
			for(key in resultMask) {
				if(!resultMask[key]) {
					delete resultMask[key];
				}
			}
		}

		// If there are no keys left in resultMask, condense to false
		if(!Object.keys(resultMask).length) return false;

		return resultMask;
	}

	for(var argIdx = 0; argIdx < arguments.length; argIdx++) {
		resultMask = andMask(resultMask, arguments[argIdx]);
		if(resultMask === false) return false;
	}
	return resultMask || false;
}
exports.andMasks = andMasks;
exports.combineAndWhitelists = andMasks;
exports.intersectObjFilters = andMasks;


/**
 * Check if a whitelist is valid in strict form (ie, it only contains objects and booleans)
 *
 * @param whitelist Object
 * @return Boolean
 **/

exports.validateWhitelist = function(whitelist) {
	if(whitelist !== true && whitelist !== false && (typeof whitelist != 'object' || whitelist === null)) return false;
	if(typeof whitelist == 'object') {
		for(var key in whitelist) {
			if(!exports.validateWhitelist(whitelist[key])) return false;
		}
	}
	return true;
};

exports.validateObjFilter = exports.validateWhitelist;
exports.validateMask = exports.validateWhitelist;

// Given a document, collapses it to dotted notation.
// If includeRedundantLevels is set to true, parent objects will also be included in the result
// If stopAtArrays is set, arrays will be completely replaced instead of replacing individual fields
function collapseToDotted(obj, includeRedundantLevels, stopAtArrays) {
	if(isScalar(obj)) return {};
	var result = {};
	function addObj(obj, path) {
		if(isScalar(obj) || (Array.isArray(obj) && stopAtArrays)) {
			result[path] = obj;
			return;
		}
		if(includeRedundantLevels) {
			result[path] = obj;
		}
		for(var key in obj) {
			addObj(obj[key], path ? (path + '.' + key) : key);
		}
	}
	addObj(obj, '');
	delete result[''];
	return result;
}
exports.collapseDocumentToDotted = collapseToDotted;
exports.collapseObj = collapseToDotted;
exports.collapseToDotted = collapseToDotted;

// Returns an array of fields in the given object which are restricted by the given mask
function getMaskedOutFields(obj, mask) {
	var maskedOut = [];
	filterObjByMask(obj, mask, function(path) {
		maskedOut.push(path);
	});
	return maskedOut;
}
exports.getMaskedOutFields = getMaskedOutFields;
exports.listFilteredOutFields = getMaskedOutFields;
exports.getNotWhitelistedFields = getMaskedOutFields;

/**
 * Given a structured document, ensures that
 * all fields are in the given whitelist.  Returns true or false.
 *
 * @param fields Object list of fields to verify exist in whitelist
 * @param whitelist Object
 * @return Boolean
 **/

exports.checkWhitelistFields = function(obj, whitelist) {
	return getMaskedOutFields(obj, whitelist).length === 0;
};

exports.checkObjWhitelist = exports.checkWhitelistFields;


/**
 * Given a dot-notation mapping from fields to values (only 1 level deep is checked),
 * ensure that all fields are in the (structured) whitelist.
 *
 * @param fields Object list of fields to verify exist in whitelist
 * @param whitelist Object
 * @return Boolean
 **/

exports.checkDottedWhitelistFields = function(dottedObj, whitelist) {
	return Object.keys(dottedObj).every(function(path) {
		return checkMaskPath(whitelist, path);
	});
};

exports.checkDottedObjWhitelist = exports.checkDottedWhitelistFields;


///////////////// BELOW THIS LINE SHOULD BE LOOKED AT AND POSSIBLY REWRITTEN

exports.getDottedNotWhitelistedFields = function(fields, whitelist) {
	var notWhitelisted = [];
	function dottedKeyIsWhitelisted(keyParts, whitelist) {
		if(whitelist === true) return true;
		if(!whitelist) return false;
		var thisKey = keyParts[0];
		var keyIsInt = !isNaN(parseInt(thisKey, 10));
		if(keyIsInt) {
			if(Array.isArray(whitelist)) {
				if(whitelist.length != 1) {
					console.log('Invalid whitelist at ' + thisKey);
					return false;
				}
				return dottedKeyIsWhitelisted(keyParts.slice(1), whitelist[0]);
			} else {
				return false;
			}
		} else {
			if(!isScalar(whitelist)) {
				return dottedKeyIsWhitelisted(keyParts.slice(1), whitelist[thisKey]);
			} else {
				return false;
			}
		}
	}
	for(var dottedKey in fields) {
		if(!dottedKeyIsWhitelisted(dottedKey.split('.'), whitelist)) {
			notWhitelisted.push(dottedKey);
		}
	}
	return notWhitelisted;
};

exports.listFilteredOutFieldsDotted = exports.getDottedNotWhitelistedFields;

/**
 * Verifies that there are no mongo operators in the supplied query/update.  Returns true if
 * there are no operators present.
 *
 * @param d Object document update
 * @return Boolean
 **/
exports.validateNoOperators = function(d) {
	if(!isScalar(d)) {
		for(var key in d) {
			if(key[0] == '$') return false;
			if(!exports.validateNoOperators(d[key])) return false;
		}
	}
	return true;
};


/**
 * ??
 *
 * @param doc Object
 * @param update Object
 * @param whitelist Object
 * @return Object
 **/

exports.applyUpdate = function(doc, update, whitelist) {
	if(update) update = exports.collapseDocumentToDotted(update);
	if(whitelist && !exports.checkDottedWhitelistFields(update, whitelist)) return null;
	return exports.applyDottedUpdate(doc, update);
};


/**
 * Given a map from dot-notation fields to new values, apply to the document.
 * Updates are done on the document itself, then the document is returned.
 * Returns null on error (ie, try to set a subfield of a boolean)
 *
 * @param doc ??
 * @param update ??
 * @param return ??
 **/

exports.applyDottedUpdate = function(doc, update, setUndefined) {
	Object.keys(update).forEach(function(key) {
		if(typeof update[key] === undefined || update[key] === null) {
			if(setUndefined) exports.setPath(doc, key, undefined);
		} else {
			exports.setPath(doc, key, update[key]);
		}
		if(doc.markModified) doc.markModified(key);
	});
	return doc;
};


/**
 * Returns whether or not the given query fields match the document.
 *
 * @param doc The document to test
 * @param query A one-layer-deep set of key/values to check doc for
 * @return Boolean Whether or not the doc matches
 **/

exports.matchDocument = function(doc, query) {
	if(query === true) return doc === true;
	if(isScalar(query) || isScalar(doc)) return query === doc;
	for(var queryKey in query) {
		if(doc[queryKey] !== query[queryKey]) {
			return false;
		}
	}
	return true;
};

exports.matchObj = exports.matchDocument;

exports.matchStructuredDocument = function(doc, query) {
	return exports.matchDocument(exports.collapseDocumentToDotted(doc), exports.collapseDocumentToDotted(query));
};

exports.matchStructuredObj = exports.matchStructuredDocument;

/**
 * Performs complex object inheritance on a set of documents.
 *
 * The inheritance is performed according to the following rules:
 *
 * Corresponding objects are recursively merged, unless the overlay object has the _replace key
 * set to true, in which case the base object is entirely replaced by the overlay object, or unless
 * the overlay object has the _delete key, in which case the key on the base object is removed.
 * This has the same effect as setting the value in the overlay object to null.
 *
 * In cases where the overlay object has the same key as the base object, the value of the key
 * on the overlay object replaces the value on the base, unless the overlay object has the
 * _yield key set to true.  _yield only applies to the current level of depth.
 *
 * If the types of corresponding keys do not match (except in the array case described below),
 * the overlay value always replaces the base value.
 *
 * A value of null on an overlay object will cause the corresponding key on the base to be removed.
 * Null values are also removed on the base.
 *
 * Arrays in the overlay object will replace anything in the base.  To add or remove elements,
 * instead of replacing the whole array, a special overlay object can be used (with the same key
 * as the array on the base).  This object looks like:
 * {
 * array: true,
 * add: [item1, item2, item3],
 * remove: [item4, item5, item6],
 * replace: [ item7, item8, item9 ]	// replaces whole array
 * }
 * This causes items 1, 2, and 3 to be added to the base array, and items 4, 5, and 6 to be removed
 * from the base array.  The object can also look like this:
 * {
 * array: true,
 * replace: [item1, item2, item3]
 * }
 * Which behaves as if it were just an array instead of this special object.
 *
 * @param base object The base document
 * @param subDocument1 object Document to overlay
 * @param subDocument...N object More documents to overlay
 * @return object The flattened document after inheritance
 */
exports.inheritDocument = function() {
	function hasNumericKeys(obj, sequential) {
		if(isScalar(obj)) return false;
		if(!Object.keys(obj).length) return false;
		if(sequential) {
			return Object.keys(obj).sort(function(a, b) { var r = parseInt(a, 10) - parseInt(b, 10); if(isNaN(r)) return 0; }).every(function(k, idx) {
				return ''+k === ''+idx;
			});
		} else {
			return Object.keys(obj).every(function(k) {
				return (/^[0-9]+$/).test(k);
			});
		}
	}

	function merge(base, sub) {
		var key;
		if(sub === null || sub === undefined) return undefined;
		else if(!isScalar(sub)) {
			if(sub._delete === true) return undefined;
			if(sub.array === true) {
				if(Array.isArray(sub.replace || sub._replace)) return sub.replace || sub._replace;
				var retArray = [];
				if(Array.isArray(base)) retArray.push.apply(retArray, base);
				if(Array.isArray(sub.add)) sub.add.forEach(function(el) { if(retArray.indexOf(el) === -1) retArray.push(el); });
				if(Array.isArray(sub.remove)) {
					var newRetArray = [];
					retArray.forEach(function(el) {
						if(sub.remove.indexOf(el) === -1) newRetArray.push(el);
					});
					retArray = newRetArray;
				}
				return retArray;
			}
			var protoObj;
			if(Array.isArray(sub)) protoObj = [];
			else if(base && Array.isArray(base) && (sub === undefined || hasNumericKeys(sub))) protoObj = [];
			else protoObj = {};

			if(isScalar(base)) return merge(protoObj, sub);
			if(sub._replace) return merge(protoObj, sub);
			var retObj = protoObj;
			if(base && !Array.isArray(sub)) for(key in base) retObj[key] = base[key];
			for(key in sub) {
				if(sub[key] === undefined) continue;
				else if(sub[key] === null && retObj[key] !== undefined && !sub._yield) delete retObj[key];
				else if(retObj[key] !== undefined && !sub._yield) retObj[key] = merge(retObj[key], sub[key]);
				else retObj[key] = merge(Array.isArray(sub[key]) ? [] : {}, sub[key]);
			}
			for(key in retObj) {
				if(retObj[key] === undefined || retObj[key] === null) delete retObj[key];
			}
			if(Array.isArray(retObj)) {
				retObj = retObj.filter(function(el) {
					return el !== null && el !== undefined;
				});
			}
			return retObj;
		} else {
			return sub;
		}
	}
	var cur;
	for(var i = 0; i < arguments.length; i++) {
		cur = merge(cur, arguments[i]);
	}
	delete cur._replace;
	delete cur._yield;
	delete cur._delete;
	return cur;
};

exports.inherit = exports.inheritDocument;

function deepEquals(a, b) {
	if(isScalar(a) && isScalar(b)) {
		if(a instanceof Date && b instanceof Date) {
			return a.getTime() == b.getTime();
		} else {
			return a === b;
		}
	}
	if(a === null || b === null || a === undefined || b === undefined) return a === b;
	if(Array.isArray(a) && Array.isArray(b)) {
		if(a.length != b.length) return false;
		for(var i = 0; i < a.length; i++) if(a[i] !== b[i]) return false;
		return true;
	} else if(!Array.isArray(a) && !Array.isArray(b)) {
		if(!Object.keys(a).every(function(k) {
			return deepEquals(a[k], b[k]);
		})) return false;
		if(!Object.keys(b).every(function(k) {
			return deepEquals(a[k], b[k]);
		})) return false;
	} else {
		return false;
	}
}
exports.deepEquals = deepEquals;

/**
 * Returns a child object that, when overlayed on base using inheritObject, will create
 * the given result.
 *
 * @param base object The base object for the inheritance
 * @param result object The desired result
 * @return object The child to apply - may return undefined if objects are identical
 */
exports.inheritDiff = function(base, result) {
	if(deepEquals(base, result)) return undefined;
	if(!isScalar(base) && !isScalar(result)) {
		if(Array.isArray(base) || Array.isArray(result)) return result;
		var ret = {};
		Object.keys(result).forEach(function(k) {
			if(!deepEquals(base[k], result[k])) {
				var subDiff = exports.inheritDiff(base[k], result[k]);
				if(subDiff !== undefined) ret[k] = subDiff;
			}
		});
		Object.keys(base).forEach(function(k) {
			if(result[k] === undefined) ret[k] = null;
		});
		return ret;
	} else {
		return result;
	}
};

/**
 * Sets the value at a given path in an object
 *
 * @param obj object The object
 * @param path string The path, dot-separated
 * @param value mixed Value to set
 */
exports.setPath = function(obj, path, value) {
	var cur = obj;
	var parts = path.split('.');
	for(var i = 0; i < parts.length; i++) {
		if(i === parts.length - 1) cur[parts[i]] = value;
		else {
			if(isScalar(cur[parts[i]])) cur[parts[i]] = {};
			cur = cur[parts[i]];
		}
	}
	return obj;
};

exports.deletePath = function(obj, path) {
	var cur = obj;
	var parts = path.split('.');
	for(var i = 0; i < parts.length; i++) {
		if(i === parts.length - 1) delete cur[parts[i]];
		else {
			if(isScalar(cur[parts[i]])) {
				return obj;
			}
			cur = cur[parts[i]];
		}
	}
	return obj;
};

/**
 * Gets the value at a given path in an object
 *
 * @param obj object The object
 * @param path string The path, dot-separated
 * @param allowSkipArrays boolean If true: If a field in an object is an array and the
 * path key is non-numeric, and the array has exactly 1 element, then the first element
 * of the array is used.
 * @return mixed The value at the path
 */
exports.getPath = function(obj, path, allowSkipArrays) {
	var cur = obj;
	var parts = path.split('.');
	for(var i = 0; i < parts.length; i++) {
		if(isScalar(cur)) return undefined;
		if(Array.isArray(cur) && allowSkipArrays && !(/^[0-9]+$/.test(parts[i])) && cur.length == 1) {
			cur = cur[0];
			i--;
		} else {
			cur = cur[parts[i]];
		}
	}
	return cur;
};


/**
 * Creates a structured mask given a list of fields that should be included in the mask.
 */
exports.createMaskFromFieldList = function(fields) {
	var ret = {};
	for(var i = 0; i < fields.length; i++) {
		exports.setPath(ret, fields[i], true);
	}
	return ret;
};

/**
 * Returns a function that filters object fields based on a structured mask/whitelist.
 */
exports.createFilterFromMask = function(mask) {
	return function(obj) {
		exports.filterObj(obj, mask);
	};
};

},{}]},{},[])("objtools")
});