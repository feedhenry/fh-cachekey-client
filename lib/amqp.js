var fhamqpjs = require('fh-amqp-js');
var assert = require('assert');
var IntervalBuffer = require('interval-buffer');
var _ = require('underscore');

var amqpManager;
var cfg;
var appendIntervalBuffer;

function setupIntervalBuffer() {
  appendIntervalBuffer = new IntervalBuffer({
    maxSize: cfg.burstMaxSize || 100, // If buffer fills before interval, cb will be called
    interval: cfg.burstInterval || 2000 // ms
  }, function(bufferArray) {

    // Merge loglines, send a single message with batched logs
    var logs = _.pluck(bufferArray, 'log');

    // We'll use the timestamp from the last message
    var lastMessage = _.last(bufferArray);

    // And merge our logs onto it
    lastMessage.log = logs.join("\n");

    publishLog(lastMessage);
  });
}

/*
 Publish log messages on the bus, millicore will receive those logs and update memcache.
 Logs marked "persisted" will be picked up by fh-supercore and saved in mongodb
 */
module.exports = function(config) {
  cfg = config;
  setupIntervalBuffer();
  return {
    readCache: readCache,
    createCache: createCache,
    appendCache: appendCache,
    appendCacheBurst: appendCacheBurst,
    updateCache: updateCache,
    updateCacheWithLog: updateCacheWithLog,
    invalidateUserCache: invalidateUserCache
  };
};

function readCache(cachekeys, cb) {
  return cb('readCache is not supported in the AMQP cache key client');
}

function invalidateUserCache(guid, cb) {
  return cb('invalidateUserCache is not supported in the AMQP cache key client');
}

function createCache(cacheKey, persist, appId, cb) {
  assert.ok(cacheKey, 'Missing cacheKey');
  var persistFlag = persist;
  var app = appId;
  var callback = cb;
  if (arguments.length === 2) {
    persistFlag = false;
    app = null;
    callback = arguments[1];
  }
  if (persistFlag) {
    assert.ok(app !== null, 'AppId is required to persist logs');
  }
  var message = {
    key: cacheKey,
    persist: persistFlag,
    action: 'create',
    timestamp: new Date().getTime(),
    appId: app
  };
  publishLog(message, true, function(err, result) {
    if (err) {
      return callback(err);
    }
    return callback(null, result.key);
  });
}

function _createMessage(cacheKey, logMsg, progress) {
  var message = {
    key: cacheKey,
    timestamp: new Date().getTime(),
    action: 'update'
  };
  if (logMsg) {
    message.log = logMsg;
  }
  if (progress) {
    message.data = {
      progress: parseInt(progress)
    };
  }
  return message;
}

// Sending a message for every line append is very for particularly
// bursty operations (e.g. Deploys/Builds) is costly,
// so we setup an interval buffer to batch up build status lines
function appendCacheBurst(cacheKey, logMsg, progress, cb) {
  var message = _createMessage(cacheKey, logMsg, progress);
  appendIntervalBuffer.push(message);
  return cb();
}

function appendCache(cacheKey, logMsg, progress, cb) {
  var message = _createMessage(cacheKey, logMsg, progress);
  publishLog(message, cb);
}

function updateCache(cacheKey, status, action, error, cb) {
  updateCacheWithLog(cacheKey, null, 0, status, action, error, cb);
}

function updateCacheWithLog(cacheKey, logMessage, progress, status, action, error, cb) {
  var message = {
    key: cacheKey,
    timestamp: new Date().getTime(),
    action: 'update',
    data: {}
  };
  if (logMessage) {
    message.log = logMessage;
  }
  if (progress) {
    message.data.progress = progress;
  }
  if (status) {
    message.data.status = status;
  }
  if (action) {
    message.data.action = action;
  }
  if (error) {
    message.data.error = error;
  }
  publishLog(message, cb);
}

// Sample logMessage:
// {
//   key: <cachekye>,
//   persist: true or false - only need to set on creating messages
//   action: create/update/delete
//   timestamp: the time stamp int value
//   appId: the app id - only needed to persist messages on creation
//   log: the log message
//   data: {
//     status: 'pending/error/complete',
//     action: a json object,
//     error: an error message,
//     progress: the progress
//   }
// }
function publishLog(logMessage, isRpc, cb) {
  var rpc = isRpc;
  var callback = cb;
  if (arguments.length === 2) {
    rpc = false;
    callback = arguments[1];
  }
  if (!amqpManager) {
    amqpManager = new fhamqpjs.AMQPManager(cfg.amqp);
    amqpManager.connectToCluster();
  }
  var exchangeName = cfg.amqp.exchange || 'fh-internal';
  var topicName = 'fh.logs.' + logMessage.action.toLowerCase();
  if (rpc) {
    amqpManager.rpcRequest(exchangeName, topicName, logMessage, callback);
  } else {
    amqpManager.publishTopic(exchangeName, topicName, logMessage, callback);
  }
}
