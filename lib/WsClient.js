const WebSocket = require('ws');
const BaseClient = require('./BaseClient');
const { COMMANDS } = require('./constants');

class WsClient extends BaseClient {

  constructor(...args) {
    super({type: 'websocket', ...args});
    this.connectionCount = 0;

    if (typeof args[0] === 'object') {
      if (args[0].timeout) this.timeout = args[0].timeout;
      this.url = args[0].url;
    }
    else {
      this.url = args[0];
    }
    this._connect(this.url, 'ng.rtpengine.com');
  }

  _connect(opts, protocol) {
    this.socket =  new WebSocket(opts, protocol);
    this._attachHandlers(this.socket, opts, protocol);
  }

  _attachHandlers(socket, opts, protocol) {
    socket.on('message', this._onMessage.bind(this));
    socket.on('error', this._onError.bind(this));
    socket.on('open', () => {
      if (this.connectionCount++ === 0) this._onListening();
      else this.emit('reconnected');
    });
    socket.on('close', (code) => {
      this.emit('close');
      setTimeout(this._connect.bind(this, opts, protocol), 2000);
    });
  }
}

// add commands
COMMANDS.forEach((method) => {
  WsClient.prototype[method] = function(...args) {
    return this.send_internal(...[method].concat(args));
  };
});

module.exports = WsClient;
