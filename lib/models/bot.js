var fs = require('fs');
var Discordie = require('discordie');
var config = require('../config');
var rss = require('../utils/rss');
var Feed = require('./feed.js');
var client = require('./discord');

// BOT class
module.exports = function() {

  var that = this;

  // -------------------- INIT -------------------- //
  this.init = function() {

    // tasks
    this.tasks = {
      'list':           { fn: this.doList,          help: ':rss list' },
      'add':            { fn: this.doAdd,           help: ':rss add [feed url] [tags]' },
      'remove':         { fn: this.doRemove,        help: ':rss remove [feed index]' },
      'channel':        { fn: this.doChannel,       help: ':rss channel [feed index] #[channel]' },
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
    this.roles = {};

    // connect
    if(this.connect()) {

      // watch for discord events
      this.onReady();
      this.onDisconnected();
      this.onMsg();
    }
  };

  // -------------------- SAVE -------------------- //
  this.save = function(guildId) {

    // get save data
    var data = {
      feeds: [],
      roles: [],
    };
    for(var i=0; i<that.feeds[guildId].length; i++) {
      var feed = that.feeds[guildId][i];
      data.feeds.push(feed.toJson());
    }
    for(var i=0; i<that.roles[guildId].length; i++) {
      var role = that.roles[guildId][i];
      data.roles.push(role);
    }

    // try to save file
    var filename = 'data/' + guildId + '.json';
    try {
      fs.writeFileSync(filename, JSON.stringify(data), 'utf-8');
    } catch(e) {
      console.log('SAVE - ' + e);
    }
  };

  // -------------------- LOAD -------------------- //
  this.load = function(guild, data) {
    console.log('Loading data for server "' + guild.name + '" ...')
    if(data.feeds) {
      for(var i=0; i<data.feeds.length; i++) {
        var feed = new Feed(data.feeds[i]);
        that.feeds[guild.id].push(feed);
        console.log('Loaded feed : ' + feed.toString());
      }
    }
    if(data.roles) {
      for(var i=0; i<data.roles.length; i++) {
        var role = data.roles[i];
        that.roles[guild.id].push(role);
        console.log('Loaded role : ' + role);
      }
    }
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
        var r = member.roles[i].name.toLowerCase();
        var roles = that.roles[guild.id];
        if((roles && roles.indexOf(r) !== -1) || r==='admin') {
          return true;
        }
      }
    }
    return false;
  };

  // -------------------- CONNECT -------------------- //
  this.connect = function() {

    // get private token
    var token;
    try {
      token = fs.readFileSync('token.txt', 'utf-8');
    } catch(e) {
      console.log(e);
      return false;
    }

    // connect
    client.connect({ 
      token: token,
    });
    return true;
  };

  // -------------------- READY EVENT -------------------- //
  this.onReady = function() {
    client.Dispatcher.on(Discordie.Events.GATEWAY_READY, function(e) {

      console.log('Connected as: ' + client.User.username);

      // set game
      client.User.setGame({ name: 'RSS' });

      // parse bot servers
      client.Guilds.forEach(function(g) {

        // init lists
        that.feeds[g.id] = [];
        that.roles[g.id] = [];

        // try to load server data
        try {
          var file = fs.readFileSync('data/' + g.id + '.json', 'utf-8');
          var data = JSON.parse(file);
          that.load(g, data);
        } catch(err) {}
      });
    });
  };

  // -------------------- DISCONNECTED EVENT -------------------- //
  this.onDisconnected = function() {
    client.Dispatcher.on(Discordie.Events.DISCONNECTED, function(e) {
      console.log('Disconnected: ', e.error);
      setTimeout(function() {
        client.connect();
      }, 60000);
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
      if(msg.startsWith(config.appCmd) && member && guild && that.isAuthorized(member, guild)) {

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
            that.tasks[task].fn(channel, params);
          }
          else {
            // if task doesn't exist
            channel.sendMessage('Sorry, I don\'t know the task "' + task + '".');
          }
        }
        else {
          // if no task
          that.tasks.help.fn(channel, params);
        }
      }
    });
  };

  // -------------------- LIST FEEDS -------------------- //
  this.doList = function(channel, params) {

    var msg = '';
    var feeds = that.feeds[channel.guild.id];

    if(feeds.length > 0) {
      msg += 'Here\'s the list of feeds I\'m watching:\n\n';
      msg += '```';
      for(var i=0; i<feeds.length; i++) {
        var f = feeds[i];
        msg += i + ' - ' + feeds[i].toString() + '\n';
      }
      msg += '```';
    }
    else {
      msg += 'I\'m not watching any feeds.';
    }
    channel.sendMessage(msg);
  };

  // -------------------- ADD FEED -------------------- //
  this.doAdd = function(channel, params) {
    if(params && params.length>0) {

      // get url param
      var url = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getMultipleParams(params);

      if(url) {
        // query rss feed to get meta
        rss.get(url)
        .then(function(data) {
          if(data && data[0] && data[0].meta) {

            var feed = new Feed({
              channel:        channel.id,
              title:          data[0].meta.title,
              description:    data[0].meta.description,
              url:            url,
              tags:           tags,
            });

            // add feed
            that.feeds[channel.guild.id].push(feed);
            that.save(channel.guild.id);
            channel.sendMessage('Added "' + feed.title + '" to the watch list.');
          }
          else {
            channel.sendMessage('Error while adding this feed.');
          }
        })
        .catch(function(err) {
          console.log('ADD FEED - ' + err);
          channel.sendMessage('Error while adding this feed : ' + err);
        });
      }
      else {
        channel.sendMessage('No feed URL specified.');
      }
    }
  };

  // -------------------- REMOVE FEED -------------------- //
  this.doRemove = function(channel, params) {
    if(params && params.length>0) {

      var index = params[0];
      var feeds = that.feeds[channel.guild.id];
      var feed = feeds[index];

      if(feed) {
        feed.stopWorker();
        var removed = feeds.splice(index, 1)[0];
        that.save(channel.guild.id);
        channel.sendMessage('Removed "' + removed.title + '" from the watch list.');
      }
      else {
        channel.sendMessage('That feed index does not exist.');
      }
    }
  };

  // -------------------- SWITCH CHANNEL -------------------- //
  this.doChannel = function(channel, params) {
    if(params && params.length>1) {

      var index = params.splice(0, 1)[0];
      var feeds = that.feeds[channel.guild.id];
      var feed = feeds[index];

      if(feed) {

        var c = params.splice(0, 1)[0];

        // get id
        if(c.startsWith('<#') && c.endsWith('>')) {

          c = c.substr(2, c.length-3);

          // set + save
          var newChannel = feed.setChannel(c);
          if(newChannel) {
            that.save(channel.guild.id);
            channel.sendMessage('Moved feed "' + feed.title + '" to channel "' + newChannel.name + '".');
          }
          else {
            channel.sendMessage('Channel not found.');
          }
        }
        else {
          channel.sendMessage('Channel not found.');
        }
      }
      else {
        channel.sendMessage('That feed index does not exist.');
      }
    }
  };

  // -------------------- REMOVE ALL FEEDS -------------------- //
  this.doCleanup = function(channel, params) {
    var feeds = that.feeds[channel.guild.id];
    for(var i=0, ie=feeds.length; i<ie; i++) {
      that.doRemove(channel, [0]);
    }
  };

  // -------------------- ADD TAGS -------------------- //
  this.doAddTags = function(channel, params) {
    if(params && params.length>0) {

      // get feed index param
      var index = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getMultipleParams(params);

      // add tags to feed
      var feed = that.feeds[channel.guild.id][index];
      if(feed) {
        feed.addTags(tags);
        that.save(channel.guild.id);
        channel.sendMessage('Added tags [' + tags.toString() + '] to the feed "' + feed.title + '".');
      }
      else {
        channel.sendMessage('That feed index does not exist.');
      }
    }
  };

  // -------------------- REMOVE TAGS -------------------- //
  this.doRemoveTags = function(channel, params) {
    if(params && params.length>0) {

      // get feed index param
      var index = params.splice(0, 1)[0];

      // get tags params
      var tags = that.getMultipleParams(params);

      // remove tags from feed
      var feed = that.feeds[channel.guild.id][index];
      if(feed) {
        feed.removeTags(tags);
        that.save(channel.guild.id);
        channel.sendMessage('Removed tags [' + tags.toString() + '] from the feed "' + feed.title + '".');
      }
      else {
        channel.sendMessage('That feed index does not exist.');
      }
    }
  };

  // -------------------- LIST ROLES -------------------- //
  this.doListRoles = function(channel, params) {
    var serverRoles = that.roles[channel.guild.id];
    if(serverRoles.length>0) {
      var msg = 'Here\'s the list of authorized roles:\n\n';
      msg += '```';
      for(var i=0; i<serverRoles.length; i++) {
        msg += '- ' + serverRoles[i] + '\n';
      }
      msg += '```';
      channel.sendMessage(msg);
    }
    else {
      channel.sendMessage('No roles config for this server.');
    }
  };

  // -------------------- ADD ROLES -------------------- //
  this.doAddRoles = function(channel, params) {

    // get roles
    var roles = that.getMultipleParams(params);

    // add roles
    for(var i=0; i<roles.length; i++) {
      var role = roles[i].toLowerCase();
      that.roles[channel.guild.id].push(role);
    }
    that.save(channel.guild.id);
    channel.sendMessage('Added roles [' + roles.toString() + '] to the list of authorized roles.');
  };

  // -------------------- REMOVE ROLES -------------------- //
  this.doRemoveRoles = function(channel, params) {

    // get roles
    var roles = that.getMultipleParams(params);
    var serverRoles = that.roles[channel.guild.id];

    // remove roles
    for(var i=0; i<roles.length; i++) {
      var role = roles[i].toLowerCase();
      var index = serverRoles.indexOf(role);
      if(index !== -1) {
        serverRoles.splice(index, 1);
      }
    }
    that.save(channel.guild.id);
    channel.sendMessage('Removed tags [' + roles.toString() + '] from the list of authorized roles.');
  };

  // -------------------- HELP -------------------- //
  this.doHelp = function(channel, params) {
    var msg = '```\n';
    for(var i in that.tasks) {
      var t = that.tasks[i];
      if(t.help) {
        msg += i.toUpperCase();
        for(var n=0; n<(20-i.length); n++) {
          msg += ' ';
        }
        msg += t.help + '\n';
      }
    }
    msg += '```';
    channel.sendMessage(msg);
  };

  // -------------------- SING -------------------- //
  this.doSing = function(channel, params) {
    channel.sendMessage(':notes:');
  };

  // exec init
  this.init();
};