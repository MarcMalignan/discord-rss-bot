var Discordie = require('discordie');
var config = require('../config');
var commons = require('../utils/commons');
var rss = require('../utils/rss');
var Feed = require('./feed.js');

// BOT class
module.exports = function(client) {

  var that = this;

  // -------------------- INIT -------------------- //
  this.init = function() {

    // authorized roles
    this.roles = config.roles || [];

    // tasks
    this.tasks = {
      'list':           { fn: this.doList,          help: ':rss list' },
      'add':            { fn: this.doAdd,           help: ':rss add [feed url] [tags]' },
      'remove':         { fn: this.doRemove,        help: ':rss remove [feed index]' },
      'cleanup':        { fn: this.doCleanup,       help: ':rss cleanup' },
      'add-tags':       { fn: this.doAddTags,       help: ':rss add-tags [feed index] [tags]' },
      'remove-tags':    { fn: this.doRemoveTags,    help: ':rss remove-tags [feed index] [tags]' },
      'list-roles':     { fn: this.doListRoles,     help: ':rss list-roles' },
      'add-roles':      { fn: this.doAddRoles,      help: ':rss add-roles [roles]' },
      'remove-roles':   { fn: this.doRemoveRoles,   help: ':rss remove-roles [roles]' },
      'help':           { fn: this.doHelp },
      'sing':           { fn: this.doSing },
    };

    // RSS feed
    this.feeds = [];

    // watch for discord events
    this.onReady();
    this.onMsg();
  };

  // -------------------- GET MULTIPLE PARAMS -------------------- //
  this.getMultipleParams = function(params) {
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

  // -------------------- CHECK USER ROLE -------------------- //
  this.isAuthorized = function(member, guild) {
    if(member.id === guild.owner_id) {
      return true;
    }
    else {
      for(var i=0; i<member.roles.length; i++) {
        var r = member.roles[i];
        if(that.roles.indexOf(r.name.toLowerCase()) !== -1) {
          return true;
        }
      }
    }
    return false;
  };

  // -------------------- READY EVENT -------------------- //
  this.onReady = function() {
    client.Dispatcher.on(Discordie.Events.GATEWAY_READY, function(e) {
      console.log('Connected as: ' + client.User.username);
    });
  };

  // -------------------- MESSAGE EVENT -------------------- //
  this.onMsg = function() {
    client.Dispatcher.on(Discordie.Events.MESSAGE_CREATE, function(e) {

      var msg = e.message.content;
      var member = e.message.member;
      var guild = e.message.guild;

      // if rss command + authorized user
      if(msg.startsWith(config.appCmd) && that.isAuthorized(member, guild)) {

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
            commons.msg(e, 'Sorry, I don\'t know the task "' + task + '".');
          }
        }
        else {
          // if no task
          commons.msg(e, 'Hi there!');
        }
      }
    });
  };

  // -------------------- LIST FEEDS -------------------- //
  this.doList = function(e, params) {

    var msg = '';

    var nb = that.feeds.length;
    switch(nb) {
      case 0:   msg += 'I\'m not watching any feeds.'; break;
      case 1:   msg += 'I\'m watching 1 feed.\n'; break;
      default:  msg += 'I\'m watching ' + nb + ' feeds.\n';
    }

    for(var i=0; i<nb; i++) {
      var f = that.feeds[i];
      msg += i + ' - ' + that.feeds[i].toString() + '\n';
    }
    commons.msg(e, msg);
  };

  // -------------------- ADD FEED -------------------- //
  this.doAdd = function(e, params) {
    if(params && params.length>0) {

      // get url param
      var url = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getMultipleParams(params);

      // query rss feed to get meta
      rss.get(url)
      .then(function(data) {
        if(data && data[0] && data[0].meta) {

          var feed = new Feed({
            evt:            e,
            title:          data[0].meta.title,
            description:    data[0].meta.description,
            url:            url,
            tags:           tags,
          });

          that.feeds.push(feed);
          commons.msg(e, 'Added "' + feed.title + '" to the watch list.');
        }
        else {
          commons.msg(e, 'Error while adding this feed.');
        }
      })
      .catch(function(err) {
        console.log('ERROR - ' + err);
        commons.msg(e, 'Error while adding this feed : ' + err);
      });
    }
  };

  // -------------------- REMOVE FEED -------------------- //
  this.doRemove = function(e, params) {
    if(params && params.length>0) {
      var index = params[0];
      var feed = that.feeds[index];
      if(feed) {
        feed.stopWorker();
        var removed = that.feeds.splice(index, 1)[0];
        commons.msg(e, 'Removed "' + removed.title + '" from the watch list.');
      }
      else {
        commons.msg(e, 'That feed index does not exist.');
      }
    }
  };

  // -------------------- REMOVE ALL FEEDS -------------------- //
  this.doCleanup = function(e, params) {
    for(var i=0, ie=that.feeds.length; i<ie; i++) {
      that.doRemove(e, [0]);
    }
  };

  // -------------------- ADD TAGS -------------------- //
  this.doAddTags = function(e, params) {
    if(params && params.length>0) {

      // get feed index param
      var index = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getMultipleParams(params);

      // add tags to feed
      var feed = that.feeds[index];
      if(feed) {
        feed.addTags(tags);
        commons.msg(e, 'Added tags [' + tags.toString() + '] to the feed "' + feed.title + '".');
      }
      else {
        commons.msg(e, 'That feed index does not exist.');
      }
    }
  };

  // -------------------- REMOVE TAGS -------------------- //
  this.doRemoveTags = function(e, params) {
    if(params && params.length>0) {

      // get feed index param
      var index = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getMultipleParams(params);

      // remove tags from feed
      var feed = that.feeds[index];
      if(feed) {
        feed.removeTags(tags);
        commons.msg(e, 'Removed tags [' + tags.toString() + '] from the feed "' + feed.title + '".');
      }
      else {
        commons.msg(e, 'That feed index does not exist.');
      }
    }
  };

  // -------------------- LIST ROLES -------------------- //
  this.doListRoles = function(e, params) {
    var msg = 'Here\'s the list of authorized roles:\n';
    for(var i=0; i<that.roles.length; i++) {
      msg += '- ' + that.roles[i] + '\n';
    }
    commons.msg(e, msg);
  };

  // -------------------- ADD ROLES -------------------- //
  this.doAddRoles = function(e, params) {

    // get roles
    var roles = that.getMultipleParams(params);

    // add roles
    for(var i=0; i<roles.length; i++) {
      var role = roles[i].toLowerCase();
      that.roles.push(role);
    }
    commons.msg(e, 'Added roles [' + roles.toString() + '] to the list of authorized roles.');
  };

  // -------------------- REMOVE ROLES -------------------- //
  this.doRemoveRoles = function(e, params) {

    // get roles
    var roles = that.getMultipleParams(params);

    // remove roles
    for(var i=0; i<roles.length; i++) {
      var role = roles[i].toLowerCase();
      var index = that.roles.indexOf(role);
      if(index !== -1) {
        that.roles.splice(index, 1);
      }
    }
    commons.msg(e, 'Removed tags [' + roles.toString() + '] from the list of authorized roles.');
  };

  // -------------------- HELP -------------------- //
  this.doHelp = function(e, params) {
    var msg = 'Here\'s what I can do:\n'
    
    for(var i in that.tasks) {
      var t = that.tasks[i];
      if(t.help) {
        msg += i + '\t\t' + t.help + '\n';
      }
    }
    commons.msg(e, msg);
  };

  // -------------------- SING -------------------- //
  this.doSing = function(e, params) {
    commons.msg(e, ':notes:');
  };

  // exec init
  this.init();
};