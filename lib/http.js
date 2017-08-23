var util = require('util');
var request = require('request');
var IntervalBuffer = require('interval-buffer');
var _ = require('underscore');
var assert = require('assert');

var appendIntervalBuffer;
var cfg;
var rejectUnauthorized;


function appendArray(bufferArray) {

  var logs = _.pluck(bufferArray, 'logMsg');
  // Use latest message key etc.
  var baseMessage = _.last(bufferArray);
  // Append all logs in buffer to latest message
  baseMessage.logMsg = logs.join('\n');

  request.post({ rejectUnauthorized : rejectUnauthorized, url: cfg.url + '/box/srv/1.1/dat/log/append', json: baseMessage});
}

function appendIntervalBufferContents(bufferArray) {
  _
  .chain(bufferArray)
  // If multiple cache keys then group them together
  .groupBy('cacheKey')
  // For each group send a burst log post
  .each(appendArray);
}

function setupIntervalBuffer(cb) {
  appendIntervalBuffer = new IntervalBuffer({
    // Run cb if buffer array gets to this size
    maxSize: cfg.burstMaxSize || 100,
    interval: cfg.burstInterval || 2000 // ms
  }, cb);
}

// Client Millicore API for caching, hits LogBean in millicore.
module.exports = function(config) {
  cfg = config.millicore,
  /*
  When one component runs on `http`, only accessible behind the LB (e.g. scm), it needs to be able to
  still connect with components running https
  */
    rejectUnauthorized = (typeof config.rejectUnauthorized !== 'undefined') ? config.rejectUnauthorized : true;

  var headers = {
    "X-FH-AUTH-USER": cfg.serviceKey
  };

  setupIntervalBuffer(appendIntervalBufferContents);

  return {
    readCache: readCache,
    createCache: createCache,
    appendCache: appendCache,
    appendCacheBurst: appendCacheBurst,
    updateCache: updateCache,
    invalidateUserCache:  invalidateUserCache
  };

  /**
   *
   * @param guid
   * @param cb
   * @doc This will cause the user version to be updated and so invalidate the users current context and ensure the next request
   * causes perms to be re requested
   */
  function invalidateUserCache(guid, cb) {
    var url = cfg.url + '/box/srv/1.1/ent/ten/User/update';
    request.post({ rejectUnauthorized : rejectUnauthorized, url: url, json: {"guid": guid , "fields":{}}, headers: headers}, function(err, res, body) {
      if (err) {
        return cb(err);
      }
      if (res.statusCode !== 200) {
        return cb('Unexpected response code: ' + res.statusCode + ' - ' + util.inspect(body));
      }
      return cb(null, body);
    });
  }

  function readCache(cacheKeys, cb) {
    request.get({ rejectUnauthorized : rejectUnauthorized, url : cfg.url + '/box/srv/1.1/dat/log/read?cacheKeys='+ JSON.stringify(cacheKeys) },cb);
  }

  function createCache(cacheKey, cb) {
    assert.ok(cacheKey, 'Missing cacheKey');
    var payload = {
      cacheKey: cacheKey
    };
    request.post({ rejectUnauthorized : rejectUnauthorized, url: cfg.url + '/box/srv/1.1/dat/log/create', json: payload}, cb);
  }

  // Note: progress can be null here
  function appendCacheBurst(cacheKey, logMsg, progress, cb) {
    assert.ok(cacheKey, 'Missing cacheKey');
    assert.ok(logMsg, 'Missing logMsg');
    assert.ok(cb, 'Missing callback, check number of params');

    var payload = {
      logMsg: logMsg,
      progress: progress,
      cacheKey: cacheKey
    };

    appendIntervalBuffer.push(payload);
    cb();
  }

  // Note: progress can be null here
  function appendCache(cacheKey, logMsg, progress, cb) {
    assert.ok(cacheKey, 'Missing cacheKey');
    assert.ok(logMsg, 'Missing logMsg');
    assert.ok(cb, 'Missing callback, check number of params');
    var payload = {
      logMsg: logMsg,
      progress: progress,
      cacheKey: cacheKey
    };
    request.post({ rejectUnauthorized : rejectUnauthorized, url: cfg.url + '/box/srv/1.1/dat/log/append', json: payload}, cb);
  }

  // Note: action & error can both be null
  // action must be an object
  function updateCache(cacheKey, status, action, error, cb) {
    assert.ok(cacheKey, 'Missing cacheKey');
    assert.ok(status, 'Missing status');
    if (action) {
      assert.equal(typeof action, 'object');
    }

    var payload = {
      status: status,
      cacheKey: cacheKey
    };
    if (action) {
      payload.action = action;
    }
    if (error) {
      payload.error = error;
    }

    request.post({ rejectUnauthorized : rejectUnauthorized, url: cfg.url + '/box/srv/1.1/dat/log/update', json: payload}, cb);
  }

};
