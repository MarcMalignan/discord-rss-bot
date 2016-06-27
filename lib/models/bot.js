var Discordie = require('discordie');
var config = require('../config');

var client = new Discordie();

// BOT class
module.exports = function() {

  // BOT init
  this.init = function() {

    this.evt = {
      ready:  Discordie.Events.GATEWAY_READY,
      msg:    Discordie.Events.MESSAGE_CREATE,
    };

    client.connect({ 
      token: config.appToken,
    });

    this.onReady();
    this.onMsg();
  };

  // READY event
  this.onReady = function() {
    client.Dispatcher.on(this.evt.ready, function(e) {
      console.log('Connected as: ' + client.User.username);
    });
  };

  // MESSAGE event
  this.onMsg = function() {
    client.Dispatcher.on(this.evt.msg, function(e) {
      if(e.message.content === 'ping') {
        e.message.channel.sendMessage('pong');
      }
    });
  };

  // exec init
  this.init();
};