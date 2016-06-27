// FEED class
module.exports = function(params) {

  this.init = function(params) {
    this.title = params.title;
    this.description = params.description;
    this.url = params.url;
  };

  this.init(params);
};