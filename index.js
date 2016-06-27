var Discordie = require('discordie');
var Events = Discordie.Events;
var client = new Discordie();

client.connect({ token: 'MTk2OTY4ODAzNDA4NTQzNzQ0.ClLArA.be5T8kevAyqv-es32PxjxTv5TjU' });

client.Dispatcher.on(Events.GATEWAY_READY, e => {
  console.log('Connected as: ' + client.User.username);
});

client.Dispatcher.on(Events.MESSAGE_CREATE, e => {
  if (e.message.content == 'ping') {
    e.message.channel.sendMessage('pong');
  }
});