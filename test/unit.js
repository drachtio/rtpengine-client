const test = require('tape').test;
const {Client, TcpClient} = require('..');
const RtpEngineError = require('..').RtpEngineError;
const sinon = require('sinon');
const decode = Client.decodeMessage;
const encode = Client.encodeMessage;
const debug = require('debug')('rtpengine:test');
const fs = require('fs');
const data = {
  nosplit: fs.readFileSync(`${__dirname}/data/nosplit.txt`),
  split1: fs.readFileSync(`${__dirname}/data/split-part1.txt`),
  split2: fs.readFileSync(`${__dirname}/data/split-part2.txt`),
  nonmessage: 'this is not a message',
  sample: 'd3:bar4:spam3:fooi42ee'
};

const statResponse = Buffer.from(fs.readFileSync(`${__dirname}/data/nosplit.txt`));

const roundTripTime = (startAt) => {
  const diff = process.hrtime(startAt);
  const time = diff[0] * 1e3 + diff[1] * 1e-6;
  return time.toFixed(0);
};

function fakeRtpEngine(client, message, port, host, callback) {
  const obj = decode(message);

  callback(null);

  switch (obj.data.command) {
    case 'ping':
      this.emit('message', encode(obj.id, {result: 'pong'}));
      break;
    case 'statistics':
      this.emit('message', Buffer.from([obj.id, statResponse].join(' ')));
      break;
  }
}
function fakeRtpEngineFail(client, message, port, host, callback) {
  callback(new Error('error sending'));
}

function fakeRtpEngineFail2(client, message, port, host, callback) {
  setImmediate(() => { this.emit('error', 'unexpected error of some kind'); });
}

function fakeRtpEngineFail3(client, message, port, host, callback) {
  setImmediate(() => { this.emit('message', 'unparseable message'); });
}
function fakeRtpEngineFail4(client, message, port, host, callback) {
  setImmediate(() => {
    const obj = decode(message);
    client.messages.delete(obj.id);

    callback(null);

    switch (obj.data.command) {
      case 'ping':
        this.emit('message', encode(obj.id, {result: 'pong'}));
        break;
    }
  });
}
function fakeRtpEngineFail5(client, message, port, host, callback) {
  debug('got ping message');
  setImmediate(() => {
    callback(null);
  });
}

test('new Client()', (t) => {
  t.plan(1);
  let client;
  t.doesNotThrow(() => { client = new Client(); });
  client.close();
});

test('new Client(port)', (t) => {
  t.plan(1);
  let client;
  t.doesNotThrow(() => { client = new Client(6066); });
  client.close();
});

test('new Client(port, address)', (t) => {
  t.plan(1);
  let client;
  t.doesNotThrow(() => { client = new Client(6066, '127.0.0.1'); });
  client.close();
});

test('new Client(obj)', (t) => {
  t.plan(1);
  let client;
  t.doesNotThrow(() => { client = new Client({localPort: 9099, localAddress: '127.0.0.1'}); });
  client.close();
});

test('new Client({}})', (t) => {
  t.plan(1);
  let client;
  t.doesNotThrow(() => { client = new Client({}); });
  client.close();
});

test('new Client(p1, p2, p3)', (t) => {
  t.plan(1);
  t.throws(() => { new Client(9099, '127.0.0.1', 'foobar'); });
});

test('new Client(callback)', (t) => {
  t.plan(1);
  const client = new Client(() => {
    t.pass('listening event emitted, if callback supplied');
    client.close();
  });
});

test('new Client(port, callback)', (t) => {
  t.plan(1);
  const client = new Client(6060, () => {
    t.pass('listening event emitted, if callback supplied');
    client.close();
  });
});

test('new Client(obj, callback)', (t) => {
  t.plan(1);
  const client = new Client({localPort: 9099, localAddress: '127.0.0.1'}, () => {
    t.pass('listening event emitted, if callback supplied');
    client.close();
  });
});

test('ping({port, host})', (t) => {
  t.plan(1);
  const client = new Client();
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngine.bind(client.socket, client));

  client.ping({port: 22222, host: '35.195.250.243'})
    .then((res) => {
      t.equal(res.result, 'pong', 'received \'pong\'');
      client.close();
    })
    .catch((err) => {
      client.close();
      t.fail(err);
    });
});

test('ping(port, host)', (t) => {
  t.plan(1);
  const client = new Client();
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngine.bind(client.socket, client));

  client.ping(22222, '35.195.250.243')
    .then((res) => {
      t.equal(res.result, 'pong', 'received \'pong\'');
      client.close();
    })
    .catch((err) => {
      client.close();
      t.fail(err);
    });
});

test('ping using callback', (t) => {
  t.plan(1);
  const client = new Client();
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngine.bind(client.socket, client));

  client.ping(22222, '35.195.250.243', (err, res) => {
    if (err) {
      client.close();
      return t.fail(err);
    }
    t.equal(res.result, 'pong', 'received \'pong\' when sending using callback');
    client.close();
  });
});

test('error sending', (t) => {
  t.plan(1);
  const client = new Client();
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngineFail.bind(client.socket, client));

  client.ping(22222, '35.195.250.243')
    .then((res) => {
      t.fail('expected send failure');
      client.close();
    })
    .catch((err) => {
      client.close();
      t.pass('rejects Promise when send fails');
    });
});

test('socket error', (t) => {
  t.plan(1);
  const client = new Client();
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngineFail2.bind(client.socket, client));

  client.ping(22222, '35.195.250.243');
  client.on('error', (err) => {
    t.pass('error is emitted by client');
    client.close();
  });
});

test('message parsing error', (t) => {
  t.plan(1);
  const client = new Client();
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngineFail3.bind(client.socket, client));

  client.ping(22222, '35.195.250.243');
  client.on('error', (err) => {
    t.ok(err instanceof RtpEngineError, 'RtpEngineError emitted by client');
    client.close();
  });
});

test('timeout', (t) => {
  t.plan(1);
  const client = new Client({timeout: 10});
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngineFail5.bind(client.socket, client));

  client.ping({port: 22222, host: '35.195.250.243'})
    .then((res) => {
      t.fail('expected send failure');
      client.close();
    })
    .catch((err) => {
      client.close();
      t.equals(err.message, 'rtpengine timeout host:35.195.250.243 port:22222', 'rtpengine timeout is emitted by client');
    });
});

test.skip('message correlation error', (t) => {
  t.plan(1);
  const client = new Client();
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngineFail4.bind(client.socket, client));

  client.ping(22222, '35.195.250.243');
  client.on('error', (err) => {
    t.pass();
    client.close();
  });
});


// tcp tests
const FakeRtpEngine = require('./fakeserver');
test('tcp - single message', (t) => {
  t.plan(1);
  const server = new FakeRtpEngine({port: 3457, scenario: 'nosplit'});
  const client = new TcpClient('localhost:3457');
  client.on('connect', () => {
    client.statistics()
    .then((res) => {
      t.pass();
      client.close();
      server.close();
    });
  });
});

test('tcp - message broken into two frames', (t) => {
  t.plan(1);
  const server = new FakeRtpEngine({port: 3457, scenario: 'split'});
  const client = new TcpClient('localhost:3457');
  client.on('connect', () => {
    client.statistics()
    .then((res) => {
      t.pass();
      client.close();
      server.close();
    });
  });
});

test('tcp - not a message', (t) => {
  t.plan(1);
  const server = new FakeRtpEngine({port: 3457, scenario: 'nonmessage'});
  const client = new TcpClient('localhost:3457');
  client.on('connect', () => {
    client.statistics()
    .then((res) => {
      t.pass();
      client.close();
      server.close();
    });
  });
  client.on('error', (err) => {
    console.log(`msg: ${err.message}`);
    t.pass();
    client.close();
    server.close();
  });
});

test('benchmark', (t) => {
  const total = 50000;
  let responses = 0;
  t.plan(1);
  const client = new Client();
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngine.bind(client.socket, client));

  console.log(`starting benchmark: ${total} statistics requests...`);
  const startAt = process.hrtime();
  for (let i = 0; i < total; i++) {
    const even = i % 2 === 0;
    client[even ? 'ping': 'statistics'](22222, '35.195.250.243')
      .then((res) => {
        if (++responses === total) {
          const rtt = roundTripTime(startAt);
          t.pass(`time to send/receive ${total} requests: ${rtt}ms`);
          client.close();
        }
        //else console.log({res}, `responses: ${res}`);
      })
      .catch((err) => {
        client.close();
        t.fail(err);
      });
  }
});
