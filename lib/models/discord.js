var Discordie = require('discordie');
var pvt = require('../config-private');

var client = new Discordie();
client.connect({ 
  token: pvt.appToken,
});

module.exports = client;