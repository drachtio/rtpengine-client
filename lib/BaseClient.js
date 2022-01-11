const bencode = require('bencode');
const { v4 } = require('uuid');
const Emitter = require('events').EventEmitter;
const RtpEngineError = require('./error');
const debug = require('debug')('rtpengine:baseClient');

class BaseClient extends Emitter {

  constructor(opts) {
    super();
    this.type = opts.type;
    this.connected = false;
    this.timers = new Map();
    this.timeout = opts.timeout || 0;

    this.messages = new Map();
    if (this.timeout) {
      this.timers = new Map();
    }
  }

  get connectionBased() {
    return ['tcp', 'websocket'].includes(this.type);
  }

  send_internal(name, opts) {
    return new Promise((resolve, reject) => {
      opts = opts || {};
      const cookie = v4();
      name = name.replace(/([A-Z]+)/g, ' $1').toLowerCase();

      if (name.includes('dtmf')) {
        name = name.replace('dtmf', 'DTMF');
      }

      Object.assign(opts, {command: name});
      debug(`RtpEngine: sending command: ${cookie}: ${JSON.stringify(opts)}`);

      const message = BaseClient.encodeMessage(cookie, opts);
      this.messages.set(cookie, {resolve, reject});

      if (this.timeout) {
        debug(`setting timeout: ${this.timeout}ms`);
        this.timers.set(cookie, setTimeout(this._onMessageTimeout.bind(this, cookie), this.timeout));  
      }

      if (this.type === 'udp') {
        this.socket.send(message, this.remotePort, this.remoteHost, (err) => {
          if (err) {
            debug(`error sending command to rtpengine over ws at ${this.remoteHost}:${this.remotePort}`);
            this.messages.delete(cookie);
            return reject(err);
          }
        });
      } else if (this.type === 'websocket') {
        this.socket.send(message, (err) => {
          if (err) {
            debug(`error sending command to rtpengine at ${this.url}`);
            this.messages.delete(cookie);
            return reject(err);
          }
        });
      }
      else if (this.type === 'tcp') {
        if (!this.connected) return reject('socket to rtpengine is not connected');
        this.socket.write(message, (err) => {
          if (err) {
            debug(`error sending command to rtpengine over tcp at ${this.hostport}`);
            this.messages.delete(cookie);
            return reject(err);
          }
        });
      }
    });
  }

  _onMessage(msg) {
    let obj;

    try {
      obj = BaseClient.decodeMessage(msg);
    } catch (err) {
      debug(`Error decoding message from rtpengine ${err.message}`);
      this.emit('error', new RtpEngineError(`malformed/unexpected message format ${msg}`));
      return;
    }

    if (!this.messages.has(obj.id)) {
      this.emit('error', new RtpEngineError(
        `received a response that can not be correlated to a request: ${obj.id}: ${obj.data}`));
      return;
    }

    const p = this.messages.get(obj.id);
    if (this.timers) {
      const timer = this.timers.get(obj.id);
      clearTimeout(timer);
      this.timers.delete(obj.id);  
    }

    this.messages.delete(obj.id);
    if (this.rejectOnError && obj.data.result === 'error') {
      return p.reject(obj.data['error-reason']);
    }
    p.resolve(obj.data);
  }

  _onMessageTimeout(id) {
    this.timers.delete(id);
    const p = this.messages.get(id);
    if (!p) {
      this.emit('error', new RtpEngineError(
        `received a timeout that can not be correlated to a request: ${id}`));
      return;
    }
    this.messages.delete(id);

    p.reject(new RtpEngineError('rtpengine timeout'));
  }

  _onError(err) {
    debug(`RtpEngine#_onError: ${JSON.stringify(err)}`);
    this.emit('error', err);
  }

  _onListening() {
    this.emit('listening');
    if (this.connectionBased) this.connected = true;
  }

  _onEnd() {
    this.emit('end');
    if (this.connectionBased) this.connected = false;
  }

  close() {
    if ('tcp' === this.type) this.socket.destroy();
    else this.socket.close();
    if (this.connectionBased) this.connected = false;
  }
}


BaseClient.decodeMessage = function(msg) {
  const m = msg.toString();
  const idx = m.indexOf(' ');

  if (-1 !== idx) {
    const id = m.substring(0, idx);
    const data = bencode.decode(m.substring(idx + 1), 'utf8');
    return { id, data };
  }
  debug(`no data returned from parsing ${msg}`);
  throw new Error('Error parsing message');
};

BaseClient.encodeMessage = function(id, data) {
  const message = new Buffer.from(
    [id, bencode.encode(data)].join(' ')
  );
  return message;
};

module.exports = BaseClient;
