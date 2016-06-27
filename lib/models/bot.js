var Discordie = require('discordie');
var config = require('../config');
var rss = require('../utils/rss');
var Feed = require('./feed.js');
var client = new Discordie();

// BOT class
module.exports = function() {

  var that = this;

  // BOT init
  this.init = function() {

    // discord events
    this.evt = {
      ready:  Discordie.Events.GATEWAY_READY,
      msg:    Discordie.Events.MESSAGE_CREATE,
    };

    // tasks
    this.tasks = {
      add:        this.doAdd,
      list:       this.doList,
      remove:     this.doRemove,
      sing:       this.doSing,
    };

    // RSS feed
    this.feeds = [];

    // connect discord client
    client.connect({ 
      token: config.appToken,
    });

    // watch for discord events
    this.onReady();
    this.onMsg();
  };

  // write msg
  this.msg = function(e, msg) {
    e.message.channel.sendMessage(msg);
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

      var msg = e.message.content;

      // if msg starts with base cmd
      if(msg.startsWith(config.appCmd)) {

        var split = msg.split(' ');

        // if at least base cmd + task
        if(split.length > 1) {

          // remove base
          split.splice(0, 1);

          // get task + params
          var task = split.splice(0, 1)[0];
          var params = split;

          if(that.tasks[task]) {
            // if that task exists
            that.tasks[task](e, params);
          }
          else {
            // if task doesn't exist
            that.msg(e, 'Sorry, I don\'t know the task "' + task + '".');
          }
        }
        else {
          // if no task
          that.msg(e, 'Hi there!');
        }
      }
    });
  };

  // ADD task
  this.doAdd = function(e, params) {
    if(params && params.length>0) {

      var url = params.splice(0, 1)[0];

      rss.get(url)
      .then(function(data) {
        if(data && data[0] && data[0].meta) {

          var feed = new Feed({
            title:          data[0].meta.title,
            description:    data[0].meta.description,
            url:            url,
          });

          that.feeds.push(feed);
          that.msg(e, 'Adding "' + feed.title + '" to the watch list.');
        }
        else {
          that.msg(e, 'Error while adding this feed.');
        }
      })
      .catch(function(e) {
        that.msg(e, 'Error while adding this feed.');
      });
    }
  };

  // LIST task
  this.doList = function(e, params) {
    var nb = that.feeds.length;
    e.message.channel.sendMessage('I\'m currently watching ' + nb + ' feeds.');
    for(var i=0; i<nb; i++) {
      var f = that.feeds[i];
      that.msg(e, i + ' - ' + f.title + ' : ' + f.description);
    }
  };

  // REMOVE task
  this.doRemove = function(e, params) {
    if(params && params.length>0) {
      var index = params[0];
      var removed = that.feeds.splice(index, 1)[0];
      that.msg(e, 'Removed "' + removed.title + '" from my watch list.');
    }
  };

  // SING task
  this.doSing = function(e, params) {
    that.msg(e, ':notes:');
  };

  // exec init
  this.init();
};