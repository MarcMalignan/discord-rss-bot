var Discordie = require('discordie');
var config = require('../config');
var rss = require('../utils/rss');
var Feed = require('./feed.js');
var client = new Discordie();

// BOT class
module.exports = function() {

  var that = this;

  // -------------------- BOT init -------------------- //
  this.init = function() {

    // discord events
    this.evt = {
      ready:  Discordie.Events.GATEWAY_READY,
      msg:    Discordie.Events.MESSAGE_CREATE,
    };

    // tasks
    this.tasks = {
      'list':           { fn: this.doList,        help: ':rss list' },
      'add':            { fn: this.doAdd,         help: ':rss add [feed url] [tags]' },
      'remove':         { fn: this.doRemove,      help: ':rss remove [feed index]' },
      'add-tags':       { fn: this.doAddTags,     help: ':rss add-tags [feed index] [tags]' },
      'remove-tags':    { fn: this.doRemoveTags,  help: ':rss remove-tags [feed index] [tags]' },
      'help':           { fn: this.doHelp },
      'sing':           { fn: this.doSing },
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

  // -------------------- READY event -------------------- //
  this.onReady = function() {
    client.Dispatcher.on(this.evt.ready, function(e) {
      console.log('Connected as: ' + client.User.username);
    });
  };

  // -------------------- MESSAGE event -------------------- //
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
            that.tasks[task].fn(e, params);
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

  // -------------------- GETS TAGS PARAMS -------------------- //
  this.getTags = function(params) {
    var t = (params.length>0) ? params.join(' ').split(',') : [];
    var tags = [];
    for(var i=0; i<t.length; i++) {
      var trimmed = t[i].trim();
      if(trimmed !== '') {
        tags.push(trimmed);
      }
    }
    return tags;
  };

  // -------------------- ADD FEED -------------------- //
  this.doAdd = function(e, params) {
    if(params && params.length>0) {

      // get url param
      var url = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getTags(params);

      // query rss feed to get meta
      rss.get(url)
      .then(function(data) {
        if(data && data[0] && data[0].meta) {

          var feed = new Feed({
            title:          data[0].meta.title,
            description:    data[0].meta.description,
            url:            url,
            tags:           tags,
          });

          that.feeds.push(feed);
          that.msg(e, 'Added "' + feed.title + '" to the watch list.');
        }
        else {
          that.msg(e, 'Error while adding this feed.');
        }
      })
      .catch(function(err) {
        console.log(err);
        that.msg(e, 'Error while adding this feed.');
      });
    }
  };

  // -------------------- ADD TAGS -------------------- //
  this.doAddTags = function(e, params) {
    if(params && params.length>0) {

      // get feed index param
      var index = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getTags(params);

      // add tags to feed
      var feed = that.feeds[index];
      if(feed) {
        for(var i=0; i<tags.length; i++) {
          feed.tags.push(tags[i]);
        }
        that.msg(e, 'Added tags [' + tags.toString() + '] to the feed "' + feed.title + '".');
      }
      else {
        that.msg(e, 'That feed index does not exist.');
      }
    }
  },

  // -------------------- LIST FEEDS -------------------- //
  this.doList = function(e, params) {

    var msg = '';

    var nb = that.feeds.length;
    switch(nb) {
      case 0:   msg += 'I\'m not watching any feeds.'; break;
      case 1:   msg += 'I\'m watching 1 feed.'; break;
      default:  msg += 'I\'m watching ' + nb + ' feeds.';
    }
    msg += '\n';

    for(var i=0; i<nb; i++) {
      var f = that.feeds[i];
      msg += i + ' - ' + f.title + ' - ' + f.url;
      if(f.tags.length > 0) {
        msg += ' [' + f.tags.toString() + ']';
      }
      msg += '\n';
    }
    that.msg(e, msg);
  };

  // -------------------- REMOVE FEED -------------------- //
  this.doRemove = function(e, params) {
    if(params && params.length>0) {
      var index = params[0];
      if(that.feeds[index]) {
        var removed = that.feeds.splice(index, 1)[0];
        that.msg(e, 'Removed "' + removed.title + '" from the watch list.');
      }
      else {
        that.msg(e, 'That feed index does not exist.');
      }
    }
  };

  // -------------------- REMOVE TAGS -------------------- //
  this.doRemoveTags = function(e, params) {
    if(params && params.length>0) {

      // get feed index param
      var index = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getTags(params);

      // remove tags from feed
      var feed = that.feeds[index];
      if(feed) {
        for(var i=0; i<tags.length; i++) {
          var tag = tags[i];
          var tagIndex = feed.tags.indexOf(tag);
          if(tagIndex !== -1) {
            feed.tags.splice(tagIndex, 1);
          }
        }
        that.msg(e, 'Removed tags [' + tags.toString() + '] from the feed "' + feed.title + '".');
      }
      else {
        that.msg(e, 'That feed index does not exist.');
      }
    }
  },

  // -------------------- HELP -------------------- //
  this.doHelp = function(e, params) {
    var msg = 'Here\'s what I can do:\n'
    
    for(var i in that.tasks) {
      var t = that.tasks[i];
      if(t.help) {
        msg += i + '\t\t' + t.help + '\n';
      }
    }
    that.msg(e, msg);
  };

  // -------------------- SING -------------------- //
  this.doSing = function(e, params) {
    that.msg(e, ':notes:');
  };

  // exec init
  this.init();
};