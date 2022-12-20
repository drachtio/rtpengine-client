const BaseClient = require('./BaseClient');
const net = require('net');
const RtpEngineError = require('./error');
const { COMMANDS } = require('./constants');
const debug = require('debug')('rtpengine:baseClient');


const MAX_BUFLEN = 16384;

class TcpClient extends BaseClient {

  constructor(...args) {
    super({type: 'tcp', ...args});

    if (typeof args[0] === 'object') {
      if (args[0].timeout) this.timeout = args[0].timeout;
      this.hostport = args[0].hostport;
    }
    else {
      this.hostport = args[0];
    }

    const arr = /^(.*):(\d+)$/.exec(this.hostport);
    if (!arr) throw new RtpEngineError(`rtpengine-client: invalid hostport for tcp connection: ${this.hostport}`);

    this.host = arr[1];
    this.port = arr[2];

    const socket = this.socket = new net.Socket();
    socket.setKeepAlive(true) ;

    socket.on('connect', () => {
      this.connected = true;
      this.emit('connect');
    });
    socket.on('data', this._onData.bind(this));
    socket.on('end', this._onEnd.bind(this));
    socket.on('ready', this._onListening.bind(this));
    socket.on('error', this._onError.bind(this));

    debug(`connecting tcp client to ${this.host}:${this.port}`);
    socket.connect(this.port, this.host);
  }

  _onData(msg) {
    let res;
    this.buffer = !this.buffer ? msg : Buffer.concat([this.buffer, msg]);
    if (this.buffer.length > MAX_BUFLEN) {
      this.emit('error', new RtpEngineError(`malformed/unexpected message format ${this.buffer.slice(0, 64)}...`));
      this.buffer = null;
      return;
    }
    try {
      console.log(`received ${msg.length} bytes`);
      res = BaseClient.decodeMessage(this.buffer);
    } catch (err) {
      return;
    }
    this._onParsedMessage(res);
    this.buffer = null;
  }
}

// add commands
COMMANDS.forEach((method) => {
  TcpClient.prototype[method] = function(...args) {
    return this.send_internal(...[method].concat(args));
  };
});

module.exports = TcpClient;
