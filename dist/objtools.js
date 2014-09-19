/** objtools.js - v0.0.7 - Fri, 19 Sep 2014 20:42:02 GMT */
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),(o.ZS||(o.ZS={})).objtools=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"objtools":[function(_dereq_,module,exports){

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
 * Generic structured document whitelisting function, with support for arrays.
 * The structure of the whitelist must match the structure of the document.
 * To match an array in the document, use an array with a single element in the whitelist.  This
 * whitelist element is applied to each of the document elements.
 * If a whitelist element is true, the corresponding document element is included in the result.
 * Returns the result without modifying the document.
 *
 * @param doc Array docuemnts to be filtered
 * @param whitelist Object string, whitelist object, or array of whitelist objects
 * @return Object returns a document or array of documents matching filter
 **/

exports.whitelistFilterDocument = function(doc, whitelist) {
	if(whitelist === true || whitelist === '*') return doc;
	if(Array.isArray(whitelist)) {
		if(!Array.isArray(doc)) return undefined;
		if(whitelist.length != 1) return undefined;
		var resultArray = [];
		doc.forEach(function(element) {
			resultArray.push(exports.whitelistFilterDocument(element, whitelist[0]));
		});
		return resultArray;
	}
	if(typeof whitelist === 'object') {
		if(!(typeof doc === 'object')) return undefined;
		var resultObj = {};
		for(var key in whitelist) {
			if(doc[key] !== undefined) {
				var resultElement = exports.whitelistFilterDocument(doc[key], whitelist[key]);
				if(resultElement !== undefined) {
					resultObj[key] = resultElement;
				}
			}
		}
		return resultObj;
	}
	return undefined;
};

exports.filterObj = exports.whitelistFilterDocument;


/**
 * Additively combine whitelists.  The resulting whitelist is returned.  The result
 * is a logical OR between whitelists.
 *
 * @param objects Ojbect arbitrary number of whitelist objects to be combined
 * @return Array combination of all whitelists
 **/

exports.combineWhitelists = function() {
	function combine2Whitelists(whitelist1, whitelist2) {
		if(!whitelist2) return;
		for(var key in whitelist2) {
			if(Array.isArray(whitelist1) && (key == 'length' || Array.prototype[key])) continue;
			if(whitelist1[key] === true || whitelist2[key] === undefined) continue;
			if(whitelist1[key] === undefined || whitelist2[key] === true) {
				whitelist1[key] = whitelist2[key];
				continue;
			}
			if(
				(Array.isArray(whitelist1[key]) && !Array.isArray(whitelist2[key])) ||
				(!Array.isArray(whitelist1[key]) && Array.isArray(whitelist2[key]))
			) {
				console.log('Warning: Whitelist schemas do not match at ' + key);
				continue;
			}
			if(Array.isArray(whitelist1[key])) {
				if(whitelist1[key].length != 1 || whitelist2[key].length != 1) {
					console.log('Warning: Invalid whitelist schema at ' + key);
					continue;
				}
				combine2Whitelists(whitelist1[key], whitelist2[key]);
				continue;
			}
			if(typeof whitelist1[key] == 'object' && typeof whitelist2[key] == 'object') {
				combine2Whitelists(whitelist1[key], whitelist2[key]);
				continue;
			}
			console.log('Warning: Invalid whitelist schema at ' + key);
		}
	}
	var result = {};
	for(var i = 0; i < arguments.length; i++) {
		if(arguments[i] === true) {
			result = true;
			break;
		}
		combine2Whitelists(result, arguments[i]);
	}
	return result;
};

exports.addObjFilters = exports.combineWhitelists;

/**
 * Combine whitelists with a logical AND function.  Ie, a field must exist in all
 * whitelists to be in the result.
 *
 * @param whitelist1..n object Whitelists to combine
 * @return object The resulting whitelist
 */
exports.combineAndWhitelists = function() {
	function combine2Whitelists(whitelist1, whitelist2) {
		var k, res;
		if(!whitelist1 || !whitelist2) return false;
		if(whitelist1 === true) return whitelist2;
		if(whitelist2 === true) return whitelist1;
		if(typeof whitelist1 == 'object' && typeof whitelist2 == 'object') {
			if(Array.isArray(whitelist1) && Array.isArray(whitelist2)) {
				if(whitelist1.length != 1 || whitelist2.length != 1) {
					console.log('Warning: Invalid whitelist schema');
					return false;
				}
				return [combine2Whitelists(whitelist1[0], whitelist2[0])];
			}
			if(Array.isArray(whitelist1)) {
				if(whitelist1.length != 1) {
					console.log('Warning: Invalid whitelist schema');
					return false;
				}
				res = {};
				for(k in whitelist2) {
					res[k] = combine2Whitelists(whitelist2[k], whitelist1[0]);
				}
				return res;
			}
			if(Array.isArray(whitelist2)) {
				if(whitelist2.length != 1) {
					console.log('Warning: Invalid whitelist schema');
					return false;
				}
				res = {};
				for(k in whitelist1) {
					res[k] = combine2Whitelists(whitelist1[k], whitelist2[0]);
				}
				return res;
			}
			res = {};
			for(k in whitelist1) {
				var kres = combine2Whitelists(whitelist1[k], whitelist2[k]);
				if(kres) res[k] = kres;
			}
			return res;
		} else {
			console.log('Warning: Invalid whitelist schema');
			return false;
		}
	}
	var cur = true;
	for(var i = 0; i < arguments.length; i++) {
		cur = combine2Whitelists(cur, arguments[i]);
	}
	return cur;
};

exports.intersectObjFilters = exports.combineAndWhitelists;


/**
 * Check if a whitelist is valid
 *
 * @param whitelist Object
 * @return Boolean
 **/

exports.validateWhitelist = function(whitelist) {
	if(whitelist !== true && typeof whitelist != 'object') return false;
	if(typeof whitelist == 'object') {
		for(var key in whitelist) {
			if(!exports.validateWhitelist(whitelist[key])) return false;
		}
	}
	return true;
};

exports.validateObjFilter = exports.validateWhitelist;

exports.getNotWhitelistedFields = function(obj, whitelist) {
	var notWhitelisted = [];
	function traverse(obj, whitelist, path) {
		if(whitelist === true) return;
		if(!whitelist) { notWhitelisted.push(path); return; }
		if(isScalar(obj)) { notWhitelisted.push(path); return; }
		for(var key in obj) {
			var val = obj[key];
			var subPath = path ? (path + '.' + key) : key;
			var whitelistEntry = Array.isArray(whitelist) ? whitelist[0] : whitelist[key];
			if(!whitelistEntry) { notWhitelisted.push(subPath); continue; }
			if(whitelistEntry === true) continue;
			if(isScalar(val) || isScalar(whitelistEntry)) { notWhitelisted.push(subPath); continue; }
			traverse(val, whitelistEntry, subPath);
		}
	}
	traverse(obj, whitelist, '');
	return notWhitelisted;
};

exports.listFilteredOutFields = exports.getNotWhitelistedFields;

/**
 * Given a structured document, ensures that
 * all fields are in the given whitelist.  Returns true or false.
 *
 * @param fields Object list of fields to verify exist in whitelist
 * @param whitelist Object
 * @return Boolean
 **/

exports.checkWhitelistFields = function(fields, whitelist) {
	if(whitelist === true) return true;
	if(!whitelist) return false;
	if(isScalar(fields) || isScalar(whitelist)) return false;
	for(var key in fields) {
		if(!whitelist[key]) return false;
		var fieldWhitelist = whitelist[key];
		var field = fields[key];
		if(fieldWhitelist === true) continue;
		if(!field) return false;
		if(Array.isArray(field) && Array.isArray(fieldWhitelist)) {
			if(fieldWhitelist.length != 1) {
				console.log('Warning: Invalid whitelist schema at ' + key);
				return false;
			}
			var arrayAllowed = true;
			field.forEach(function(el) {
				if(!exports.checkWhitelistFields(el, fieldWhitelist[0])) arrayAllowed = false;
			});
			if(!arrayAllowed) return false;
			continue;
		}
		if(Array.isArray(fields) || Array.isArray(whitelist)) {	// array-ness doesn't match
			return false;
		}
		if(!isScalar(field) && !isScalar(fieldWhitelist)) {
			if(!exports.checkWhitelistFields(field, fieldWhitelist)) return false;
			continue;
		}
		return false;
	}
	return true;
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

exports.checkDottedWhitelistFields = function(fields, whitelist) {
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
		if(!dottedKeyIsWhitelisted(dottedKey.split('.'), whitelist)) return false;
	}
	return true;
};

exports.checkDottedObjWhitelist = exports.checkDottedWhitelistFields;

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
 * Given a structured document, convert it into a 1-level-deep structure with
 * dotted keys for subfields.
 *
 * @param doc Object
 * @return Object
 **/

exports.collapseDocumentToDotted = function(doc) {
	if(isScalar(doc)) return doc;
	var result = {};
	var conflicts = [];
	function traverse(keyPrefix, doc) {
		if(!isScalar(doc) && !Array.isArray(doc)) {
			for(var key in doc) {
				var newKeyPrefix;
				if(keyPrefix === '') newKeyPrefix = key;
				else newKeyPrefix = keyPrefix + '.' + key;
				traverse(newKeyPrefix, doc[key]);
			}
		} else {
			if(result[keyPrefix] !== undefined) {
				conflicts.push(keyPrefix);
			} else {
				result[keyPrefix] = doc;
			}
		}
	}
	traverse('', doc);
	if(conflicts.length > 0) return null;
	return result;
};

exports.collapseObj = exports.collapseDocumentToDotted;


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