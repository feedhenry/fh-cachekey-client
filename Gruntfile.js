module.exports = function(grunt) {
  'use strict';

  // Just set shell commands for running different types of tests
  grunt.initConfig({
    _test_runner: '_mocha',
    _istanbul: 'istanbul cover --dir',
    _unit_args: '-A -u exports --recursive -t 10000 ./test/unit/test-*.js',
    _accept_args: '-A -u exports --recursive -t 10000 ./test/test-accept.js',

    // These are the properties that grunt-fh-build will use
    unit: ['echo $NODE_PATH', '<%= _test_runner %> <%= _unit_args %>'],
    accept: '<%= _test_runner %> <%= _accept_args %>',
    unit_cover: '<%= _istanbul %> cov-unit <%= _test_runner %> -- <%= _unit_args %>'
  });

  grunt.loadNpmTasks('grunt-fh-build');
  grunt.registerTask('default', ['fh-dist']);
};
