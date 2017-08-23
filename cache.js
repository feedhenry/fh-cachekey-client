var consts = require('./lib/constants.js');
module.exports = function(config) {
  var impl;
  if (config.millicore) {
    impl = require('./lib/http.js')(config);
  } else if (config.amqp) {
    impl = require('./lib/amqp.js')(config);
  } else {
    throw new Error('Invalid config. No millicore or amqp configurations found.');
  }

  for (var key in consts) {
    if (consts.hasOwnProperty(key)) {
      impl[key] = consts[key];
    }
  }

  return impl;
};
