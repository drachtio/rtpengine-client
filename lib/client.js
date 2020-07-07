const dgram = require('dgram');
const bencode = require('bencode');
const { v4 } = require('uuid');
const Emitter = require('events').EventEmitter ;
const RtpEngineError = require('./error');
const debug = require('debug')('rtpengine:client') ;
const assert = require('assert');

class Client extends Emitter {

  constructor(...args) {
    super() ;

    this.socket = dgram.createSocket('udp4');
    if (typeof args[args.length - 1] === 'function') {
      this.addListener('listening', args.pop());
    }

    this.socket.on('message', this._onMessage.bind(this)) ;
    this.socket.on('error', this._onError.bind(this)) ;
    this.socket.on('listening', this._onListening.bind(this));

    if (typeof args[0] === 'object') {
      const localPort = args[0].localPort || 0 ;
      if (!args[0].localAddress) {
        this.socket.bind(localPort);
      }
      else {
        this.socket.bind(localPort, args[0].localAddress) ;
      }
      this.timeout = args[0].timeout || 0;
      this.rejectOnError = args[0].rejectOnError;
    }
    else {
      switch (args.length) {
        case 0 :
          this.socket.bind();
          break ;
        case 1:
          this.socket.bind(args[0]);
          break ;
        case 2:
          this.socket.bind(args[0], args[1]) ;
          break ;
        default:
          throw new RtpEngineError('invalid number of arguments to rtpengine-client constructor');
      }
    }

    this.messages = new Map() ;
    if (this.timeout) {
      this.timers = new Map() ;
    }
  }

  send_internal(name, opts) {
    return new Promise((resolve, reject) => {
      opts = opts || {} ;
      const cookie = v4() ;
      name = name.replace(/([A-Z]+)/g, ' $1').toLowerCase();

      if (name.includes('dtmf')) {
        name = name.replace('dtmf', 'DTMF');
      }

      Object.assign(opts, {command: name}) ;
      debug(`RtpEngine: sending command: ${cookie}: ${JSON.stringify(opts)}`) ;

      const message = Client.encodeMessage(cookie, opts);
      this.messages.set(cookie, {resolve, reject}) ;

      if (this.timeout) {
        debug(`setting timeout: ${this.timeout}ms`);
        this.timers.set(cookie, setTimeout(this._onMessageTimeout.bind(this, cookie), this.timeout));
      }

      this.socket.send(message, this.remotePort, this.remoteHost, (err) => {
        if (err) {
          debug(`error sending command to rtpengine at ${this.remoteHost}:${this.remotePort}`) ;
          this.messages.delete(cookie) ;
          return reject(err);
        }
      });
    });
  }

  _onMessage(msg, rinfo) {
    const obj = Client.decodeMessage(msg) ;
    if (!obj) {
      this.emit('error', new RtpEngineError(`malformed/unexpected message format ${msg}`));
      return ;
    }

    if (!this.messages.has(obj.id)) {
      this.emit('error', new RtpEngineError(
        `received a response that can not be correlated to a request: ${obj.id}: ${obj.message}`));
      return ;
    }

    const p = this.messages.get(obj.id) ;
    if (this.timers) {
      const timer = this.timers.get(obj.id);
      clearTimeout(timer) ;
      this.timers.delete(obj.id);
    }

    this.messages.delete(obj.id) ;
    if (this.rejectOnError && obj.data.result === 'error') {
      return p.reject(obj.data['error-reason']);
    }
    p.resolve(obj.data);
  }

  _onMessageTimeout(id) {
    this.timers.delete(id);
    const p = this.messages.get(id) ;
    if (!p) {
      this.emit('error', new RtpEngineError(
        `received a timeout that can not be correlated to a request: ${id}`));
      return ;
    }
    this.messages.delete(id) ;

    p.reject(new RtpEngineError('rtpengine timeout'));
  }

  _onError(err) {
    debug(`RtpEngine#_onError: ${JSON.stringify(err)}`) ;
    this.emit('error', err) ;
  }

  _onListening() {
    this.emit('listening') ;
  }

  close() {
    this.socket.close() ;
  }
}

// add commands
[
  'answer',
  'delete',
  'list',
  'offer',
  'ping',
  'query',
  'startRecording',
  'stopRecording',
  'blockDTMF',
  'unblockDTMF',
  'playDTMF',
  'blockMedia',
  'unblockMedia',
  'playMedia',
  'stopMedia',
  'statistics'
].forEach((method) => {
  Client.prototype[method] = function(...args) {
    assert.ok(args.length, `must supply destination port and address in call to Client#${method}`);

    let idx = 1 ;
    if (typeof args[0] === 'object') {
      assert(typeof args[0].port === 'number', `must supply 'port' in call to Client#${method}`);
      assert(typeof args[0].host === 'string', `must supply 'host' in call to Client#${method}`);
      this.remotePort = args[0].port ;
      this.remoteHost = args[0].host ;

    }
    else {
      assert(typeof args[0] === 'number', `must supply port in call to Client#${method}`);
      assert(typeof args[1] === 'string', `must supply host in call to Client#${method}`);
      this.remotePort = args[0] ;
      this.remoteHost = args[1] ;
      idx = 2 ;
    }

    return this.send_internal(...[method].concat(args.slice(idx))) ;
  } ;
}) ;


Client.decodeMessage = function(msg) {
  const m = msg.toString() ;
  const idx = m.indexOf(' ') ;

  if (-1 !== idx) {
    const id = m.substring(0, idx) ;
    try {
      const data = bencode.decode(m.substring(idx + 1), 'utf8') ;
      return { id, data } ;
    }
    catch (err) {
      console.error(err);
    }
  }
};

Client.encodeMessage = function(id, data) {
  const message = new Buffer(
    [id, bencode.encode(data)].join(' ')
  );
  return message;
};

module.exports = Client ;
