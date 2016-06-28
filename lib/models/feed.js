// FEED class
module.exports = function(params) {

  this.init = function(params) {
    this.title = params.title;
    this.description = params.description;
    this.url = params.url;
    this.tags = params.tags;
  };

  this.toString = function() {
    var str = this.title + ' - ' + this.url;
    if(this.tags.length > 0) {
      str += ' [' + this.tags.toString() + ']';
    }
    return str;
  };

  this.addTags = function(tags) {
    if(tags) {
      for(var i=0; i<tags.length; i++) {
        this.tags.push(tags[i]);
      }
    }
  };

  this.removeTags = function(tags) {
    if(tags) {
      for(var i=0; i<tags.length; i++) {
        var tag = tags[i];
        var tagIndex = this.tags.indexOf(tag);
        if(tagIndex !== -1) {
          this.tags.splice(tagIndex, 1);
        }
      }
    }
  };

  this.init(params);
};