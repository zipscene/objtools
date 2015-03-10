module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		broccoli: {
			dist: {
				dest: 'dist'
			}
		},
		browserify: {
			dist: {
				src: 'dist/lib/index.js',
				dest: 'dist/browser/bundle.js',
				options: {
					external: [
						'babel-runtime/core-js'
					]
				}
			}
		},
		uglify: {
			dist: {
				files: {
					'dist/browser/bundle.min.js': [ 'dist/browser/bundle.js' ]
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-broccoli');
	grunt.loadNpmTasks('grunt-browserify');
	grunt.loadNpmTasks('grunt-contrib-uglify');

	grunt.registerTask('build:browser', [
		'build',
		'browserify:dist',
		'uglify:dist'
	]);

	grunt.registerTask('build', [
		'broccoli:dist:build'
	]);

	grunt.registerTask('watch', [
		'broccoli:dist:watch'
	]);

	grunt.registerTask('default', [ 'build' ]);

};

