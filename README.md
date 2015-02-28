# objtools

objtools provides several utility functions for working with structured objects.  Basic
examples of how to use are provided below.  See the `docs` directory for full information.

## Utility Functions

```javascript
var objtools = require('zs-objtools');

// Check whether a value should be treated as a scalar entity
objtools.isScalar(val)

// Check whether two objects deeply equal each other
objtools.deepEquals(a, b)

// Check whether two scalars equal each other (mostly equivalent to ===)
// but handles dates
objtools.scalarEquals(a, b)

// Make a duplicate of an object without references to the original
objtools.deepCopy(obj)

// Given an object, create a mapping from dotted paths to values
objtools.collapseToDotted({
	foo: {
		bar: {
			baz: 123
		}
	}
})
// -> { 'foo.bar.baz': 123 }
// Has additional options, see docs directory for details

// Checks if all fields in the query match corresponding fields in
// the dotted object
objtools.matchDottedObject({ 'foo.bar': 123, baz: 456 }, { 'foo.bar': 123 } )

// Checks if all fields in the query match corresponding fields in
// the object
objtools.matchObject( { foo: { bar: 123} }, { 'foo.bar': 123 } );
```

## Path Functions

These functions involve "object paths".  An object path is a dot-separated key specifying a field
in an object.  For example, in this object:

```javascript
var obj = {
	foo: {
		bar: [
			1,
			2,
			3
		]
	}
};
```

The path to `2` is `foo.bar.1` .

Examples of the path functions:

```javascript
objtools.getPath(obj, 'foo.bar.1');		// gets 2
objtools.setPath(obj, 'foo.biz', 4);	// equivalent to obj.foo.biz = 4
objtools.deletePath(obj, 'foo.biz');	// equivalent to delete obj.foo.biz
```
