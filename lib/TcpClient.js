const BaseClient = require('./BaseClient');
const net = require('net');
const RtpEngineError = require('./error');
const { COMMANDS } = require('./constants');


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
    this.buffer = '';

    const arr = /^(.*):(\d+)$/.exec(this.hostport);
    if (!arr) throw new RtpEngineError(`rtpengine-client: invalid hostport for tcp connection: ${this.hostport}`);

    this.host = arr[1];
    this.port = arr[2];

    const socket = this.socket = new net.Socket();
    socket.setEncoding('utf8');

    socket.on('connect', () => {
      this.connected = true;
      this.emit('connect');
    });
    socket.on('data', this._onData.bind(this));
    socket.on('end', this._onEnd.bind(this));
    socket.on('ready', () => this._onListening.bind(this));
    socket.on('error', this._onError.bind(this));

    socket.connect(this.port, this.host);
  }

  _onData(msg) {
    let res;
    this.buffer += msg;
    if (this.buffer.length > MAX_BUFLEN) {
      this.emit('error', new RtpEngineError(`malformed/unexpected message format ${this.buffer.slice(0, 64)}...`));
      this.buffer = '';
      return;
    }
    try {
      res = BaseClient.decodeMessage(this.buffer);
    } catch (err) {
      return;
    }
    this._onParsedMessage(res);
    this.buffer = '';
  }
}

// add commands
COMMANDS.forEach((method) => {
  TcpClient.prototype[method] = function(...args) {
    return this.send_internal(...[method].concat(args));
  };
});

module.exports = TcpClient;
