var Promise = require('bluebird');
var rss = require('parse-rss');

module.exports.get = function(path) {
  return new Promise(function(resolve, reject) {
    rss(path, function(err, data) {
      if(err) {
        return reject(err);
      }
      resolve(data);
    });
  });
};