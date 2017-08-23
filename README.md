# fh-cachekey-client

Simple CacheKey client for publishing, updating and removing cache keys with Millicore.

## Usage

var mcache = require('fh-cachekey-client')({
  millicore : {
    serviceKey : '1a2b...',
    url : 'http://testing.feedhenry.me'
  },
  rejectUnauthorized : true // passes to rejectUnauthorized property of request
})

## Tests
Unit tests:

  npm test

Acceptance tests (which don't run by default):

  ./node_modules/.bin/mocha -A -u exports --recursive -t 10000 test/test-accept.js
