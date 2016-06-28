var config = require('../config');
var commons = require('../utils/commons');
var rss = require('../utils/rss');

// FEED class
module.exports = function(params) {

  var that = this;

  // -------------------- INIT -------------------- //
  this.init = function(params) {

    this.evt = params.evt;
    this.title = params.title;
    this.description = params.description;
    this.url = params.url;
    this.tags = params.tags;

    this.minDate = Date.now();
    this.worker = null;

    this.startWorker();
  };

  // -------------------- TO STRING -------------------- //
  this.toString = function() {
    var str = this.title + ' - ' + this.url;
    if(this.tags.length > 0) {
      str += ' [' + this.tags.toString() + ']';
    }
    return str;
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
    this.worker = setInterval(this.getArticles, config.timer * 1000);
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
        var tag = that.tags[i];
        var title = article.title.toLowerCase();
        var descr = article.description.toLowerCase();
        var summary = article.summary.toLowerCase();
        if(
          title.indexOf(tag) !== -1 ||
          descr.indexOf(tag) !== -1 ||
          summary.indexOf(tag) !== -1
        ) {
          console.log(article);
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

      // parse articles
      for(var i=0; i<data.length; i++) {

        var article = data[i];
        var date = new Date(article.date);
        
        // if new article
        if(date.getTime()>that.minDate) {
          // if tag match
          if(that.checkTags(article)) {
            var msg = 'I found an article in "' + that.title + '"';
            if(that.tags.length > 0) {
              msg += ' matching the tags [' + that.tags.toString() + ']'
            }
            msg += ':\n' + article.origlink;
            commons.msg(that.evt, msg);
          }
        }
      }

      that.minDate = Date.now();
    })
    .catch(function(e) {
      console.log('ERROR - ' + e);
      commons.msg('Error while polling feed "' + that.title + '" - ' + e);
    });
  };

  this.init(params);
};