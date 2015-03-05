var esTranspiler = require('broccoli-babel-transpiler');
var pickFiles = require('broccoli-static-compiler');
var mergeTrees = require('broccoli-merge-trees');
var Promise = require('es6-promise').Promise;
var fs = require('fs');
var babelrc;
if(fs.existsSync('./.babelrc')) {
	try {
		babelrc = JSON.parse(fs.readFileSync('./.babelrc', {encoding: 'utf8'}));
	} catch (ex) {
		console.log(ex);
	}
}

// Returns a broc tree corresponding to the original source files
function getSourceTrees() {
	var pathsToSearch = [ 'lib', 'src', 'test' ];

	return {
		read: function(readTree) {
			var promises = pathsToSearch.map(function(path) {
				return new Promise(function(resolve) {
					fs.exists(path, function(exists) {
						if(exists) {
							resolve(path);
						} else {
							resolve();
						}
					});
				});
			});
			return Promise.all(promises).then(function(paths) {
				paths = paths.filter(function(path) { return !!path; });
				if (paths.length === 0) {
					throw new Error('No source paths found');
				}
				console.log('Found source paths: ' + paths.join(', '));
				var pathTrees = paths.map(function(path) {
					return pickFiles(path, {
						srcDir: '.',
						destDir: path
					});
				});
				return readTree(mergeTrees(pathTrees));
			});
		}
	};
}

var source = getSourceTrees();

var transpiledTree = esTranspiler(source, babelrc || {});


module.exports = transpiledTree;
