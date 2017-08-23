var proxyquire = require('proxyquire');
var util = require('util');
var assert = require('assert');
var sinon = require('sinon');

var cfg = {
  millicore : {
    url: 'http://dummycore',
    burstInterval: 10
  },
};


var request = {
  post: function(params, cb) {
    return cb(null, {statusCode: 200}, {
      "userName": "foo",
      "accountType": "devadmin",
      "created": 1384186939392,
      "displayName": "foo",
      "domain": "testing",
      "email": "foo@example.com",
      "prefs": {
        "accountType": "enterprise"
      }
    });
  },
  get: function(params, cb) {
    return cb(null, {statusCode: 200}, {
      "userName": "foo",
      "accountType": "devadmin",
      "created": 1384186939392,
      "displayName": "foo",
      "domain": "testing",
      "email": "foo@example.com",
      "prefs": {
        "accountType": "enterprise"
      }
    });
  }
};


exports.it_should_test_interval_buffer = function (done) {

  var callback = sinon.spy();
  // Redefine request post to perform checks instead of a HTTP request
  var request = {
    post: function(params, cb) {
      // Ensure the correct endpoint is being used
      assert.equal(params.url, 'http://dummycore/box/srv/1.1/dat/log/append');
      // Ensure concatenation of log messages
      assert.equal(params.json.logMsg, 'firstMsg\nsecondMsg');
      // Ensure appendCacheBurst cb param is called once for each run
      assert.ok(callback.calledTwice);
      return done();
    }
  };
  var cache = proxyquire('../../lib/http.js', {'request': request})(cfg);

  // Append two messages to test concatenation is being performed
  cache.appendCacheBurst('cacheKey', 'firstMsg', null, callback);
  cache.appendCacheBurst('cacheKey', 'secondMsg', null, callback);
};

exports.it_should_test_interval_buffer_with_multiple_keys = function (done) {

  var requestPost = sinon.spy();
  var callback = sinon.spy();
  var callCount = 0;
  // Test only passes if request has been made 3 times, one for each key group
  var request = {
    post: function(params, cb) {
      switch (callCount += 1) {
        case 1:
          assert.equal(params.json.cacheKey, 'firstKey');
          assert.equal(params.json.logMsg, 'firstMsg\nfirstMsg');
          break;
        case 2:
          assert.equal(params.json.cacheKey, 'secondKey');
          assert.equal(params.json.logMsg, 'secondMsg');
          break;
        case 3:
          assert.equal(params.json.cacheKey, 'thirdKey');
          assert.equal(params.json.logMsg, 'thirdMsg');
          done();
          break;
      }
    }
  };

  var cache = proxyquire('../../lib/http.js', {'request': request})(cfg);
  // Publish multiple messages with different keys to test that they are being
  // grouped together
  cache.appendCacheBurst('firstKey', 'firstMsg', null, callback);
  cache.appendCacheBurst('secondKey', 'secondMsg', null, callback);
  cache.appendCacheBurst('firstKey', 'firstMsg', null, callback);
  cache.appendCacheBurst('thirdKey', 'thirdMsg', null, callback);
}

exports.it_should_invalidate_cache = function (cb){
  var cache = proxyquire('../../lib/http.js', {'request': request})(cfg);
  cache.invalidateUserCache({"guid":"asdasd"},function(err, data) {
    assert.ok(!err, 'Unexpected error: ' + util.inspect(err));
    return cb();
  });
};

exports.it_should_test_cache = function(finish) {
  var request = {
    get: function(params, cb) {
      return cb(null, {statusCode: 200}, {});
    },
    post: function(params, cb) {
      return cb(null, {statusCode: 200}, {});
    }
  };
  var key = 'abc';
  var cache = proxyquire('../../lib/http.js', { 'request': request})(cfg);
  cache.readCache([key], function(err, data) {
    cache.createCache([key], function(err) {
      cache.appendCache(key, 'msg', '', function(err) {
        cache.appendCacheBurst(key, 'msg', '', function(err) {
          cache.updateCache(key, 'status', null, null, function(err) {
            return finish();
          });
        });
      });
    });
  });
};
