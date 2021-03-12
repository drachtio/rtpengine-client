const bencode = require('bencode');
const { v4 } = require('uuid');
const Emitter = require('events').EventEmitter;
const RtpEngineError = require('./error');
const debug = require('debug')('rtpengine:baseClient');

class BaseClient extends Emitter {

  constructor(...args) {
    super();
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

      this.socket.send(message, this.remotePort, this.remoteHost, (err) => {
        if (err) {
          debug(`error sending command to rtpengine at ${this.remoteHost}:${this.remotePort}`);
          this.messages.delete(cookie);
          return reject(err);
        }
      });
    });
  }

  _onMessage(msg) {
    const obj = BaseClient.decodeMessage(msg);
    if (!obj) {
      this.emit('error', new RtpEngineError(`malformed/unexpected message format ${msg}`));
      return;
    }

    if (!this.messages.has(obj.id)) {
      this.emit('error', new RtpEngineError(
        `received a response that can not be correlated to a request: ${obj.id}: ${obj.message}`));
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
  }

  close() {
    this.socket.close();
  }
}


BaseClient.decodeMessage = function(msg) {
  const m = msg.toString();
  const idx = m.indexOf(' ');

  if (-1 !== idx) {
    const id = m.substring(0, idx);
    try {
      const data = bencode.decode(m.substring(idx + 1), 'utf8');
      return { id, data };
    }
    catch (err) {
      console.error(err);
    }
  }
};

BaseClient.encodeMessage = function(id, data) {
  const message = new Buffer.from(
    [id, bencode.encode(data)].join(' ')
  );
  return message;
};

module.exports = BaseClient;
