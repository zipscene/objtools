var esTranspiler = require('broccoli-babel-transpiler');
var Promise = require('es6-promise');
var fs = require('fs');

// Returns a broc tree corresponding to the original source files
function getSourceTrees() {
	var pathsToSearch = [ 'lib', 'src', 'test' ];
	var promises = [];

	pathsToSearch.forEach(function(path) {
		promises.push(new Promise(function(resolve) {
			fs.exists(path, function(exists) {
				if(exists) {
					resolve(path);
				} else {
					resolve();
				}
			});
		}));
	});

	Promise.all(promises).then(function(paths) {
		paths = paths.filter(function(path) {
			return !!path;
		});
		if (paths.length === 0) {
			throw new Error('No source paths found');
		}
		console.log('Found source paths: ' + paths.join(', '));
		
	});
}

var libTree = 'lib';
var testTree = 'test';

var transpiledTree = esTranspiler(libTree, {
});

module.exports = transpiledTree;
