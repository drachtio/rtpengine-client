const dgram = require('dgram');
const assert = require('assert');
const BaseClient = require('./BaseClient');
const RtpEngineError = require('./error');
const { COMMANDS } = require('./constants');
const debug = require('debug')('rtpengine:Client');

class Client extends BaseClient {

  constructor(...args) {
    super({type: 'udp', ...args});

    this.socket = dgram.createSocket('udp4');
    if (typeof args[args.length - 1] === 'function') {
      this.addListener('listening', args.pop());
    }

    this.socket.on('message', this._onMessage.bind(this));
    this.socket.on('error', this._onError.bind(this));
    this.socket.on('listening', this._onListening.bind(this));

    if (typeof args[0] === 'object') {
      const localPort = args[0].localPort || 0;
      if (!args[0].localAddress) {
        this.socket.bind(localPort);
      }
      else {
        this.socket.bind(localPort, args[0].localAddress);
      }
      if (args[0].timeout) this.timeout = args[0].timeout;
      this.rejectOnError = args[0].rejectOnError;
    }
    else {
      switch (args.length) {
        case 0 :
          this.socket.bind();
          break;
        case 1:
          this.socket.bind(args[0]);
          break;
        case 2:
          this.socket.bind(args[0], args[1]);
          break;
        default:
          throw new RtpEngineError('invalid number of arguments to rtpengine-client constructor');
      }
    }

    this.messages = new Map();
    if (this.timeout) {
      this.timers = new Map();
    }
  }

  _onListening() {
    const r = process.env.UDP_RECV_BUFSIZE || process.env.UDP_BUFSIZE;
    const s = process.env.UDP_SEND_BUFSIZE || process.env.UDP_BUFSIZE;

    try {
      if (r) {
        const recvBufSize = parseInt(r, 10);
        if (recvBufSize > 0) {
          this.socket.setRecvBufferSize(recvBufSize);
        }
      }
      if (s) {
        const sendBufSize = parseInt(s, 10);
        if (sendBufSize > 0) {
          this.socket.setSendBufferSize(sendBufSize);
        }
      }
    } catch (err) {
      console.log({err, r, s}, 'rtpengine-client: error setting udp buffer size');
    }
    super._onListening();
  }
}

// add commands
COMMANDS.forEach((method) => {
  Client.prototype[method] = function(...args) {
    assert.ok(args.length, `must supply destination port and address in call to Client#${method}`);

    debug(args);
    let idx = 1;
    if (typeof args[0] === 'object') {
      assert(typeof args[0].port === 'number', `must supply 'port' in call to Client#${method}`);
      assert(typeof args[0].host === 'string', `must supply 'host' in call to Client#${method}`);
      this.remotePort = args[0].port;
      this.remoteHost = args[0].host;

    }
    else {
      assert(typeof args[0] === 'number', `must supply port in call to Client#${method}`);
      assert(typeof args[1] === 'string', `must supply host in call to Client#${method}`);
      this.remotePort = args[0];
      this.remoteHost = args[1];
      idx = 2;
    }

    const a = [method].concat(args.slice(idx));
    debug(a);
    return this.send_internal(...[method].concat(args.slice(idx)));
  };
});

module.exports = Client;
