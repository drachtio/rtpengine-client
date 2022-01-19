const net = require('net');
const assert = require('assert');
const fs = require('fs');
const data = {
  nosplit: fs.readFileSync(`${__dirname}/data/nosplit.txt`),
  split1: fs.readFileSync(`${__dirname}/data/split-part1.txt`),
  split2: fs.readFileSync(`${__dirname}/data/split-part2.txt`),
  nonmessage: 'this is not a message',
  sample: 'd3:bar4:spam3:fooi42ee'
};
const debug = require('debug')('rtpengine:test');

const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class FakeServer {
  constructor({port, scenario}) {
    assert.ok(['nosplit', 'split', 'combine', 'nonmessage'].includes(scenario), `invalid scenario: ${scenario}`);
    this.scenario = scenario;
    this.server = net.createServer();
    this.server.listen(port);

    this.server.on('connection', this._onConnection.bind(this));
    this.server.on('error', this._onError.bind(this));

    debug(`FakeServer - listening on port ${port}`);

  }

  close() {
    debug('FakeServer - close');
    this.server.close();
  }

  _onConnection(socket) {
    socket.on('error', (err) => {});
    socket.on('data', (d) => {
      const arr = /^(.*)\s/.exec(d.toString());
      const msgId = arr[1];
      debug({data: d.toString()}, `got data with msg id ${msgId}`);
      switch (this.scenario) {
        case 'nosplit':
          socket.write(`${msgId} ${data.nosplit}`);
          break;
        case 'split':
          socket.write(`${msgId} ${data.split1}`, 'utf8');
          waitFor(500)
            .then(() => {
              socket.write(data.split2, 'utf8');
            })
          break;
        case 'nonmessage':
          for (let i = 0; i < 10000; i++) {
            if (!socket.destroyed) socket.write(`${msgId} this is not bencoded `, 'utf8');
            }
          break;
        default:
          socket.write(`${msgId} ${data.combine}`, 'utf8');
          break;     
      }
    });
  }

  _onError(err) {
    console.error('Fakserver error', err);
    throw(err);
  }
}

module.exports = FakeServer;
