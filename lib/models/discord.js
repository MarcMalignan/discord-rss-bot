var fs = require('fs');
var Discordie = require('discordie');

var client = new Discordie();

// get private token
var token;
try {
  token = fs.readFileSync('token.txt', 'utf-8');
} catch(e) {
  console.log('ERROR - ' + e);
}

// connect
client.connect({ 
  token: token,
});

module.exports = client;