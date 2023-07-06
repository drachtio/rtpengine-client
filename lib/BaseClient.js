const bencode = require('bencode');
const v4 = require('uuid-random');
const Emitter = require('events').EventEmitter;
const RtpEngineError = require('./error');
const { getRtpEngineNameForCommand } = require('./constants');
const debug = require('debug')('rtpengine:baseClient');

class BaseClient extends Emitter {

  constructor(opts) {
    super();
    this.type = opts.type;
    this.connected = false;
    this.timers = new Map();
    this.timeout = opts.timeout || 0;

    this.messages = new Map();
    this.incomingMsgs = [];
    if (this.timeout) {
      this.timers = new Map();
    }
  }

  get connectionBased() {
    return ['tcp', 'websocket'].includes(this.type);
  }

  send_internal(name, opts, callback) {
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    opts = {
      ...opts,
      command: getRtpEngineNameForCommand(name)
    };

    debug(`RtpEngine: ${name} ${JSON.stringify(opts)}, callback: ${typeof callback}}`);

    const __x = (opts, callback) => {
      const cookie = v4();
      const message = BaseClient.encodeMessage(cookie, opts);
      this.messages.set(cookie, callback);

      debug(`RtpEngine: sending command: ${cookie}: ${JSON.stringify(opts)}`);

      if (this.timeout) {
        debug(`setting timeout: ${this.timeout}ms`);
        this.timers.set(cookie, setTimeout(this._onMessageTimeout.bind(this, cookie), this.timeout));
      }

      if (this.type === 'udp') {
        this.socket.send(message, this.remotePort, this.remoteHost, (err) => {
          if (err) {
            debug(`error sending command to rtpengine over ws at ${this.remoteHost}:${this.remotePort}`);
            this.messages.delete(cookie);
            return callback(err);
          }
        });
      } else if (this.type === 'websocket') {
        this.socket.send(message, (err) => {
          if (err) {
            debug(`error sending command to rtpengine at ${this.url}`);
            this.messages.delete(cookie);
            return callback(err);
          }
        });
      }
      else if (this.type === 'tcp') {
        if (!this.connected) return callback('socket to rtpengine is not connected');
        this.socket.write(message, (err) => {
          if (err) {
            debug(`error sending command to rtpengine over tcp at ${this.hostport}`);
            this.messages.delete(cookie);
            return callback(err);
          }
        });
      }
    };

    if (callback) {
      __x(opts, callback) ;
      return this ;
    }

    return new Promise((resolve, reject) => {
      __x(opts, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });
  }

  _handleIncomingMessages() {
    while (this.incomingMsgs.length) {
      const msg = this.incomingMsgs.shift();
      try {
        const obj = BaseClient.decodeMessage(msg);
        this._onParsedMessage(obj);
      } catch (err) {
        console.log({err}, 'error decoding message from rtpengine');
        debug(`Error decoding message from rtpengine ${err.message}`);
        this.emit('error', new RtpEngineError(`malformed/unexpected message format ${msg}`));
      }
    }
  }

  _onMessage(msg) {
    this.incomingMsgs.push(msg);
    setImmediate(this._handleIncomingMessages.bind(this));
  }

  _onParsedMessage(obj) {
    if (!this.messages.has(obj.id)) {
      console.log({data: obj.data}, `received a response from rtpengine with unknown msg id: '${obj.id}'`);
      this.emit('error', new RtpEngineError(
        `received a response that can not be correlated to a request: ${obj.id}: ${obj.data}`));
      return;
    }

    const callback = this.messages.get(obj.id);
    if (this.timers) {
      const timer = this.timers.get(obj.id);
      clearTimeout(timer);
      this.timers.delete(obj.id);
    }

    this.messages.delete(obj.id);
    if (this.rejectOnError && obj.data.result === 'error') {
      return callback(obj.data['error-reason']);
    }
    setImmediate(callback.bind(null, null, obj.data));
  }

  _onMessageTimeout(id) {
    this.timers.delete(id);
    const callback = this.messages.get(id);
    if (!callback) {
      this.emit('error', new RtpEngineError(
        `received a timeout that can not be correlated to a request: ${id}`));
      return;
    }
    this.messages.delete(id);

    let connDetails = '';
    if (this.type === 'udp') {
      connDetails = `host:${this.remoteHost} port:${this.remotePort}`;
    } else if (this.type === 'websocket') {
      connDetails = `url:${this.url}`;
    }  else if (this.type === 'tcp') {
      connDetails = `hostport:${this.hostport}`;
    }

    callback(new RtpEngineError(`rtpengine timeout ${connDetails}`));
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
  const idx = msg.indexOf(' ');
  if (idx === 36) {
    const buf1 = msg.subarray(0, idx);
    const buf2 = msg.subarray(idx + 1);
    const data = bencode.decode(buf2, 'utf8');
    const obj = { id: buf1.toString(), data };
    return obj;
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
