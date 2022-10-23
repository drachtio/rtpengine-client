const dgram = require('dgram');
const assert = require('assert');
const BaseClient = require('./BaseClient');
const RtpEngineError = require('./error');
const { COMMANDS } = require('./constants');
const debug = require('debug')('rtpengine:Client');

class Client extends BaseClient {

  constructor(...args) {
    super({type: 'udp', ...args});
    this.sockets = [];
    this.idx = 0;

    if (typeof args[args.length - 1] === 'function') {
      console.log('got callback');
      this.addListener('listening', args.pop());
    }

    const numClientSockets = args[0]?.numClientSockets || process.env.UDP_RTPENGINE_NUM_CLIENT_SOCKETS || 1;
    if (numClientSockets < 1 || numClientSockets > 100) {
      throw new Error('rtpenine-client: numClientSockets must be between 1 and 100');
    }
    for (let i = 0; i < numClientSockets; i++) {
      const socket = dgram.createSocket('udp4');
      socket.on('message', this._onMessage.bind(this));
      socket.on('listening', this._onListening.bind(this, socket));
      socket.on('error', this._onError.bind(this));

      /* bind socket */
      if (typeof args[0] === 'object') {
        const localPort = numClientSockets === 1 ? (args[0].localPort || 0) : 0;
        if (!args[0].localAddress) {
          socket.bind(localPort);
        }
        else {
          socket.bind(localPort, args[0].localAddress);
        }
        if (args[0].timeout) this.timeout = args[0].timeout;
        this.rejectOnError = args[0].rejectOnError;
      }
      else {
        switch (args.length) {
          case 0 :
            socket.bind();
            break;
          case 1:
            socket.bind(args[0]);
            break;
          case 2:
            socket.bind(args[0], args[1]);
            break;
          default:
            throw new RtpEngineError('invalid number of arguments to rtpengine-client constructor');
        }
      }

      this.sockets.push(socket);
    }

    this.messages = new Map();
    if (this.timeout) {
      this.timers = new Map();
    }
  }

  _onListening(socket) {
    const r = process.env.UDP_RECV_BUFSIZE || process.env.UDP_BUFSIZE;
    const s = process.env.UDP_SEND_BUFSIZE || process.env.UDP_BUFSIZE;

    try {
      if (r) {
        const recvBufSize = parseInt(r, 10);
        if (recvBufSize > 0) {
          socket.setRecvBufferSize(recvBufSize);
        }
      }
      if (s) {
        const sendBufSize = parseInt(s, 10);
        if (sendBufSize > 0) {
          socket.setSendBufferSize(sendBufSize);
        }
      }
    } catch (err) {
      console.log({err, r, s}, 'rtpengine-client: error setting udp buffer size');
    }
    super._onListening();
  }

  get socket() {
    return this.sockets[0];
  }

  get numClientSockets() {
    return this.sockets.length;
  }

  send(message, remotePort, remoteHost, callback) {
    const i = ++this.idx % this.numClientSockets;
    console.log(`sending using socket ${i}`);
    return this.sockets[i].send(message, remotePort, remoteHost, callback);
  }

  close() {
    this.sockets.forEach((socket) => {
      console.log('closing socket');
      socket.close();
    });
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
