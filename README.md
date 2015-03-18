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

// Update the destination object in-place to match the source object.  This
// also takes a third argument of hooks to register while traversing.  See
// the docs for details.
objtools.syncObject( { /* destination object */ }, { /* source object */ } );
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

## Masks

A "mask" is a structured mapping from keys to boolean `true`.  For example, take this object:

```javascript
{
	foo: {
		bar: {
			baz: 12,
			biz: 'test123',
			buz: 'bip'
		}
	}
}
```

A mask that matches only the `biz` field would be:

```javascript
{
	foo: {
		bar: {
			biz: true
		}
	}
}
```

A mask that matches anything inside the `bar` object would be:

```javascript
{
	foo: {
		bar: true
	}
}
```

A mask that matches all fields is simply `true`, whereas a mask that
matches no fields is `false`.

Masks can also contain wildcards.  For example, a mask that matches everything in
the `bar` object except for `baz` is:

```javascript
{
	foo: {
		bar: {
			_: true,
			baz: false
		}
	}
}
```

Arrays can also be used as aliases for wildcards.  These two masks are equivalent:

```javascript
{ _: { foo: true, bar: true } }
[ { foo: true, bar: true } ]
```

These are some of the functions that can be performed on masks.  See the docs directory
for details.  This is not a complete list.

```javascript
var ObjectMask = require('zs-objtools').ObjectMask;

// Create a mask
var mask = new ObjectMask({
	foo: true,
	bar: {
		biz: {
			buz: true
		}
	}
});

// Filter an object by the mask
// Takes additional options, see docs for details
mask.filterObject(obj)

// Get a subcomponent of a mask
mask.getSubMask('bar.biz')	// { buz: true }

// Check to see if the mask allows a given path
mask.checkPath('bar.biz.buz')

// Convert an ObjectMask object back into a plain object
mask.toObject()

// Validate a mask according to strict rules (only objects, arrays, and booleans)
mask.validate()

// List all fields in an object restricted by a mask
mask.getMaskedOutFields(obj)

// Returns true if all fields in the object are allowed by the mask
mask.checkFields(obj)

// Combine two or more masks such that the resulting mask matches everything that either
// of the source masks match (ie, a logical OR)
ObjectMask.addMasks(mask, mask2, ...)

// Combine two or more masks such that the result mask matches only what ALL of the
// source masks match (ie, a logical AND)
ObjectMask.andMasks(mask, mask2, ...)
```

