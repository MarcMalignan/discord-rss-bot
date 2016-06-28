var Discordie = require('discordie');
var config = require('./lib/config');
var Bot = require('./lib/models/bot');

// App class
function App() {

  // get private params
  var pvt;
  try {
    pvt = require('./lib/config-private');
    for(var i in pvt) {
      config[i] = pvt[i];
    }
  } catch(e) {
    console.log('ERROR - ' + e);
  }

  // if got private params
  if(pvt && pvt.appToken) {

    // connect discord client
    var client = new Discordie();
    client.connect({ 
      token: pvt.appToken,
    });

    // instantiate bot
    var b = new Bot(client);
  }
};

// launch app
var app = new App();