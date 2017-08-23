var util = require('util');
var assert = require('assert');

var cfg = {
  url: 'http://testing.feedhenry.me',
  "serviceKey": "ZYXWVUTSRQPONM0987654321"
};

exports.it_should_test_cache = function(finish) {
  var mc = require('../cache.js')({millicore : cfg });
  var key = 'testing1234';
  mc.createCache(key, function(err, resp, data) {
    assert.ok(!err, 'Unexpected error: ' + util.inspect(err));
    console.log("create", data);

    mc.appendCache(key, 'Stage started', 1, function(err, resp, data) {
      assert.ok(!err, err);
      console.log("append", data);

      mc.readCache([{cacheKey: key, start: 0}], function(err, resp, data) {
        assert.ok(!err, err);
        console.log("read", data);

        mc.appendCache(key, 'Stage in progress', 2, function(err, resp, data) {
          assert.ok(!err, err);
          console.log("append 2", data);

          mc.readCache([{cacheKey: key, start: 0}], function(err, resp, data) {
            assert.ok(!err, err);
            console.log("read2 ", data);

            mc.updateCache(key, mc.COMPLETE, null, null, function(err, resp, data) {
              assert.ok(!err, err);
              console.log("update", data);
              return finish();
            });
          });
        });
      });
    });
  });
};
