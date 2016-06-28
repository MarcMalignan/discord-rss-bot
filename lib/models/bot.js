var Discordie = require('discordie');
var config = require('../config');
var rss = require('../utils/rss');
var Feed = require('./feed.js');

// BOT class
module.exports = function(client) {

  var that = this;

  // -------------------- INIT -------------------- //
  this.init = function() {

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
    this.feeds = {};

    // authorized roles
    this.roles = [];

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
        if(that.roles.indexOf(r.name.toLowerCase()) !== -1 || r.name.toLowerCase()==='admin') {
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
      var channel = e.message.channel;

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
            that.tasks[task].fn(guild, channel, params);
          }
          else {
            // if task doesn't exist
            channel.sendMessage('Sorry, I don\'t know the task "' + task + '".');
          }
        }
        else {
          // if no task
          channel.sendMessage('Hi there!');
        }
      }
    });
  };

  // -------------------- LIST FEEDS -------------------- //
  this.doList = function(guild, channel, params) {

    var msg = '';
    var feeds = that.feeds[guild.id];

    var nb = feeds ? feeds.length : 0;
    switch(nb) {
      case 0:   msg += 'I\'m not watching any feeds.'; break;
      case 1:   msg += 'I\'m watching 1 feed.\n'; break;
      default:  msg += 'I\'m watching ' + nb + ' feeds.\n';
    }

    for(var i=0; i<nb; i++) {
      var f = feeds[i];
      msg += i + ' - ' + feeds[i].toString() + '\n';
    }
    channel.sendMessage(msg);
  };

  // -------------------- ADD FEED -------------------- //
  this.doAdd = function(guild, channel, params) {
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
            channel:        channel,
            title:          data[0].meta.title,
            description:    data[0].meta.description,
            url:            url,
            tags:           tags,
          });

          if(!that.feeds[guild.id]) {
            that.feeds[guild.id] = [];
          }
          that.feeds[guild.id].push(feed);
          channel.sendMessage('Added "' + feed.title + '" to the watch list.');
        }
        else {
          channel.sendMessage('Error while adding this feed.');
        }
      })
      .catch(function(err) {
        console.log('ERROR - ' + err);
        channel.sendMessage('Error while adding this feed : ' + err);
      });
    }
  };

  // -------------------- REMOVE FEED -------------------- //
  this.doRemove = function(guild, channel, params) {
    if(params && params.length>0) {

      var index = params[0];
      var feeds = that.feeds[guild.id];

      if(feeds) {
        var feed = feeds[index];
        if(feed) {
          feed.stopWorker();
          var removed = feeds.splice(index, 1)[0];
          channel.sendMessage('Removed "' + removed.title + '" from the watch list.');
        }
        else {
          channel.sendMessage('That feed index does not exist.');
        }
      }
      else {
        channel.sendMessage('I\'m not watching any feeds on this server.');
      }
    }
  };

  // -------------------- REMOVE ALL FEEDS -------------------- //
  this.doCleanup = function(guild, channel, params) {
    var feeds = that.feeds[guild.id];
    if(feeds) {
      for(var i=0, ie=feeds.length; i<ie; i++) {
        that.doRemove(guild, channel, [0]);
      }
    }
    else {
      channel.sendMessage('I\'m not watching any feeds on this server.');
    }
  };

  // -------------------- ADD TAGS -------------------- //
  this.doAddTags = function(guild, channel, params) {
    if(params && params.length>0) {

      // get feed index param
      var index = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getMultipleParams(params);

      var feeds = that.feeds[guild.id];
      if(feeds) {
        // add tags to feed
        var feed = feeds[index];
        if(feed) {
          feed.addTags(tags);
          channel.sendMessage('Added tags [' + tags.toString() + '] to the feed "' + feed.title + '".');
        }
        else {
          channel.sendMessage('That feed index does not exist.');
        }
      }
      else {
        channel.sendMessage('I\'m not watching any feeds on this server.');
      }
    }
  };

  // -------------------- REMOVE TAGS -------------------- //
  this.doRemoveTags = function(guild, channel, params) {
    if(params && params.length>0) {

      // get feed index param
      var index = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getMultipleParams(params);

      var feeds = that.feeds[guild.id];
      if(feeds) {
        // remove tags from feed
        var feed = that.feeds[index];
        if(feed) {
          feed.removeTags(tags);
          channel.sendMessage('Removed tags [' + tags.toString() + '] from the feed "' + feed.title + '".');
        }
        else {
          channel.sendMessage('That feed index does not exist.');
        }
      }
      else {
        channel.sendMessage('I\'m not watching any feeds on this server.');
      }
    }
  };

  // -------------------- LIST ROLES -------------------- //
  this.doListRoles = function(guild, channel, params) {
    var msg = 'Here\'s the list of authorized roles:\n';
    for(var i=0; i<that.roles.length; i++) {
      msg += '- ' + that.roles[i] + '\n';
    }
    channel.sendMessage(msg);
  };

  // -------------------- ADD ROLES -------------------- //
  this.doAddRoles = function(guild, channel, params) {

    // get roles
    var roles = that.getMultipleParams(params);

    // add roles
    for(var i=0; i<roles.length; i++) {
      var role = roles[i].toLowerCase();
      that.roles.push(role);
    }
    channel.sendMessage('Added roles [' + roles.toString() + '] to the list of authorized roles.');
  };

  // -------------------- REMOVE ROLES -------------------- //
  this.doRemoveRoles = function(guild, channel, params) {

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
    channel.sendMessage('Removed tags [' + roles.toString() + '] from the list of authorized roles.');
  };

  // -------------------- HELP -------------------- //
  this.doHelp = function(guild, channel, params) {
    var msg = 'Here\'s what I can do:\n'
    
    for(var i in that.tasks) {
      var t = that.tasks[i];
      if(t.help) {
        msg += i + '\t\t' + t.help + '\n';
      }
    }
    channel.sendMessage(msg);
  };

  // -------------------- SING -------------------- //
  this.doSing = function(guild, channel, params) {
    channel.sendMessage(':notes:');
  };

  // exec init
  this.init();
};