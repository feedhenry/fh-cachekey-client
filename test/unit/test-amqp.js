var proxyquire = require('proxyquire');
var assert = require('assert');
var sinon = require('sinon');

var sandbox, mockAmqp, connectToCluster, publishTopic, rpc;

exports.beforeEach = function(done){
  sandbox = sinon.sandbox.create();
  var MockAmapManager = function(){
  };
  connectToCluster = sandbox.stub();
  publishTopic = sandbox.stub();
  publishTopic.callsArg(3);
  rpc = sandbox.stub();
  rpc.callsArgWith(3, null, {});
  MockAmapManager.prototype.connectToCluster = connectToCluster;
  MockAmapManager.prototype.publishTopic = publishTopic;
  MockAmapManager.prototype.rpcRequest = rpc;
  mockAmqp = {
    AMQPManager: MockAmapManager
  }
  done();
};

exports.afterEach = function(done){
  sandbox.restore();
  done();
};

exports.test_create_cache_with_persist = function(done){
  var amqp = proxyquire('../../lib/amqp.js', {
    'fh-amqp-js': mockAmqp
  })({amqp: {}});

  var cachekey = 'test_cache_key';
  var appId = 'testAppId';
  var cb = sandbox.spy();
  amqp.createCache(cachekey, true, appId, cb);
  assert.ok(cb.called);
  assert.ok(connectToCluster.called);
  assert.ok(rpc.calledWith('fh-internal', 'fh.logs.create'));
  var message = rpc.args[0][2];
  assert.equal(message.key, cachekey);
  assert.ok(message.persist);
  assert.equal(message.action, 'create');
  assert.equal(message.appId, appId);
  assert.ok(message.timestamp);
  done();
};

exports.test_create_cache_without_persist = function(done){
  var amqp = proxyquire('../../lib/amqp.js', {
    'fh-amqp-js': mockAmqp
  })({amqp: {}});

  var cachekey = 'test_cache_key';
  var cb = sandbox.spy();
  amqp.createCache(cachekey, cb);
  assert.ok(cb.called);
  assert.ok(connectToCluster.called);
  assert.ok(rpc.calledWith('fh-internal', 'fh.logs.create'));
  var message = rpc.args[0][2];
  assert.equal(message.key, cachekey);
  assert.ok(!message.persist);
  assert.equal(message.action, 'create');
  assert.ok(!message.appId);
  assert.ok(message.timestamp);
  done();
};

exports.test_append_cache = function(done){
  var amqp = proxyquire('../../lib/amqp.js', {
    'fh-amqp-js': mockAmqp
  })({amqp: {}});

  var cachekey = 'test_cache_key';
  var cb = sandbox.spy();
  var logMessage = 'test log message';
  amqp.appendCache(cachekey, logMessage, 0, cb);
  assert.ok(cb.called);
  assert.ok(connectToCluster.called);
  assert.ok(publishTopic.calledWith('fh-internal', 'fh.logs.update'));
  var message = publishTopic.args[0][2];
  assert.equal(message.key, cachekey);
  assert.equal(message.log, logMessage);
  assert.equal(message.action, 'update');
  assert.ok(message.timestamp);
  done();
};

exports.test_update_cache = function(done){
  var amqp = proxyquire('../../lib/amqp.js', {
    'fh-amqp-js': mockAmqp
  })({amqp: {}});

  var cachekey = 'test_cache_key';
  var logMessage = 'test log message';
  var cb = sandbox.spy();
  amqp.updateCacheWithLog(cachekey, logMessage, 0, 'pending', null, null, cb);
  assert.ok(cb.called);
  assert.ok(connectToCluster.called);
  assert.ok(publishTopic.calledWith('fh-internal', 'fh.logs.update'));
  var message = publishTopic.args[0][2];
  assert.equal(message.key, cachekey);
  assert.equal(message.action, 'update');
  assert.ok(message.timestamp);
  assert.equal(message.log, logMessage);
  assert.ok(message.data);
  assert.equal(message.data.status, 'pending');
  done();
};