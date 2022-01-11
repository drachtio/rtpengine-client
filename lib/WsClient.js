const WebSocket = require('ws');
const BaseClient = require('./BaseClient');
const { COMMANDS } = require('./constants');

class WsClient extends BaseClient {

  constructor(...args) {
    super({type: 'websocket', ...args});
    this.url = args[0];
    if (args[0].timeout) this.timeout = args[0].timeout;
    this.socket =  new WebSocket(args[0], 'ng.rtpengine.com');

    this.socket.on('message', this._onMessage.bind(this));
    this.socket.on('error', this._onError.bind(this));
    this.socket.on('open', this._onListening.bind(this));
  }
}

// add commands
COMMANDS.forEach((method) => {
  WsClient.prototype[method] = function(...args) {
    return this.send_internal(...[method].concat(args));
  };
});

module.exports = WsClient;
