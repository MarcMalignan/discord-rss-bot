var fs = require('fs');
var crypto = require('crypto');
var config = require('../config');
var rss = require('../utils/rss');
var client = require('./discord');

// FEED class
module.exports = function(params) {

  var that = this;

  // -------------------- INIT -------------------- //
  this.init = function(params) {

    // try to get channel by id
    that.setChannel(params.channel);

    this.title =        params.title;
    this.description =  params.description;
    this.url =          params.url;
    this.tags =         params.tags;

    this.hash =         crypto.createHash('md5').update(this.url).digest('hex');

    // try to load posts data
    this.posted = [];
    try {
      var file = fs.readFileSync('data/' + params.channel + '_' + that.hash + '.json', 'utf-8');
      this.posted = JSON.parse(file);
    } catch(err) {}

    this.posted = [];

    this.worker = null;
    this.startWorker();
  };

  // -------------------- TO STRING -------------------- //
  this.toString = function() {
    var str = this.title + ' - ' + this.url;
    if(this.tags.length > 0) {
      str += ' [' + this.tags.toString() + ']';
    }
    str += ' > #' + this.channel.name;
    return str;
  };

  // -------------------- TO JSON -------------------- //
  this.toJson = function() {
    return {
      channel:      this.channel.id,
      title:        this.title,
      description:  this.description,
      url:          this.url,
      tags:         this.tags,
    };
  };

  // -------------------- SORT BY DATE -------------------- //
  this.sortByDate = function(a, b) {
    var dateA = new Date(a.date);
    var dateB = new Date(b.date);
    return dateB - dateA;
  };

  // -------------------- SET CHANNEL -------------------- //
  this.setChannel = function(value) {
    var channel = client.Channels.getBy('id', value);
    if(channel && (!that.channel || that.channel.guild.id === channel.guild.id)) {
      that.channel = channel;
      if(that.worker) {
        that.restartWorker();
      }
      return channel;
    }
    else {
      console.log('SET CHANNEL - channel "' + value + '" not found');
    }
  };

  // -------------------- ADD TAGS -------------------- //
  this.addTags = function(tags) {
    if(tags) {
      for(var i=0; i<tags.length; i++) {
        this.tags.push(tags[i]);
      }
      this.restartWorker();
    }
  };

  // -------------------- REMOVE TAGS -------------------- //
  this.removeTags = function(tags) {
    if(tags) {
      for(var i=0; i<tags.length; i++) {
        var tag = tags[i];
        var tagIndex = this.tags.indexOf(tag);
        if(tagIndex !== -1) {
          this.tags.splice(tagIndex, 1);
        }
      }
      this.restartWorker();
    }
  };

  // -------------------- START WORKER -------------------- //
  this.startWorker = function() {
    // get minDate
    rss.get(that.url)
    .then(function(data) {

      // sort articles
      data.sort(that.sortByDate);

      if(data[0]) {
        // get minDate from articles
        var date = new Date(data[0].date);
        that.minDate = date.getTime();
      }
      else {
        // default minDate
        that.minDate = Date.now();
      }
    })
    .catch(function(e) {
      that.minDate = Date.now();
    })
    .then(function() {
      // start worker
      that.getArticles();
      that.worker = setInterval(that.getArticles, config.timer * 1000);
    });
  };

  // -------------------- STOP WORKER -------------------- //
  this.stopWorker = function() {
    clearInterval(this.worker);
  };

  // -------------------- RESTART WORKER -------------------- //
  this.restartWorker = function() {
    this.stopWorker();
    this.startWorker();
  };

  // -------------------- CHECK TAGS -------------------- //
  this.checkTags = function(article) {
    if(that.tags.length > 0) {
      var matches = 0;
      // check if article matches all tags
      for(var i=0; i<that.tags.length; i++) {
        var tag = that.tags[i].toLowerCase();
        var title = article.title.toLowerCase();
        var descr = article.description.toLowerCase();
        var summary = article.summary.toLowerCase();
        if(
          title.indexOf(tag) !== -1 ||
          descr.indexOf(tag) !== -1 ||
          summary.indexOf(tag) !== -1
        ) {
          matches++;
        }
      }
      return (matches === that.tags.length);
    }
    else {
      return true;
    }
  };

  // -------------------- GET ARTICLES -------------------- //
  this.getArticles = function() {
    rss.get(that.url)
    .then(function(data) {

      // sort articles
      data.sort(that.sortByDate);

      // parse articles
      for(var i=data.length-1; i>=0; i--) {

        var article = data[i];
        var date = new Date(article.date);
        var link = article.origlink || article.link;
        
        // check article
        if(that.minDate && date.getTime()>that.minDate 
          && that.checkTags(article) 
          && link && that.posted.indexOf(link)===-1
          ) {

          that.postMsg(link);
        }

        // get date from latest article
        if(i===0) {
          that.minDate = date.getTime();
        }
      }
    })
    .catch(function(e) {
      console.log('GET ARTICLES - ' + e);
    });
  };

  // -------------------- POST MSG -------------------- //
  this.postMsg = function(link) {

    var msg = 'I found an article in "' + that.title + '"';
    if(that.tags.length > 0) {
      msg += ' matching the tags [' + that.tags.toString() + ']'
    }
    msg += ':\n' + link;

    that.channel.sendMessage(msg)
    .then(function() {

      // add to posted list
      that.posted.push(link);
      if(that.posted.length > 100) {
        that.posted.shift();
      }

      // try to save file
      var filename = 'data/' + that.channel.id + '_' + that.hash + '.json';
      try {
        fs.writeFileSync(filename, JSON.stringify(that.posted), 'utf-8');
      } catch(e) {
        console.log('SAVE POSTS - ' + e);
      }

    })
    .catch(function(e) {
      console.log(e.response.error);
    });
  };

  this.init(params);
};