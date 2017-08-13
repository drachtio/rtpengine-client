const dgram = require('dgram');
const bencode = require('bencode');
const uuid = require('uuid/v4') ;
const Emitter = require('events').EventEmitter ;
const debug = require('debug')('rtpengine-client') ;
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
          throw new Error('invalid number of arguments to rtpengine-client constructor');
      }
    }

    this.messages = new Map() ;
  }

  send_internal(name, opts) {
    return new Promise((resolve, reject) => {
      opts = opts || {} ;
      const cookie = uuid() ;

      Object.assign(opts, {command: name}) ;
      debug(`RtpEngine: sending command: ${cookie}: ${JSON.stringify(opts)}`) ;

      const message = Client.encodeMessage(cookie, opts);
      this.messages.set(cookie, {resolve, reject}) ;

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
      this.emit('error', new Error(`malformed/unexpected message format ${msg}`));
      return ;
    }

    if (!this.messages.has(obj.id)) {
      this.emit('error', new Error(
        `received a response that can not be correlated to a request: ${obj.id}: ${obj.message}`));
      return ;
    }

    const p = this.messages.get(obj.id) ;

    this.messages.delete(obj.id) ;
    p.resolve(obj.data);
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
  'startRecording'
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
