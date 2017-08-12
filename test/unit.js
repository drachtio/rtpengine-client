const test = require('tape').test ;
const Client = require('..').Client ;
const sinon = require('sinon');
const decode = Client.decodeMessage;
const encode = Client.encodeMessage;

function fakeRtpEngine(message, port, host, callback) {
  const obj = decode(message);

  callback(null);

  switch (obj.data.command) {
    case 'ping':
      this.emit('message', encode(obj.id, {result: 'pong'}));
      break;
  }
}

test('new Client()', (t) => {
  t.plan(1);
  let client ;
  t.doesNotThrow(() => { client = new Client(); }) ;
  client.close() ;
}) ;

test('new Client(port)', (t) => {
  t.plan(1);
  let client ;
  t.doesNotThrow(() => { client = new Client(6066); }) ;
  client.close() ;
}) ;

test('new Client(port, address)', (t) => {
  t.plan(1);
  let client ;
  t.doesNotThrow(() => { client = new Client(6066, '127.0.0.1'); }) ;
  client.close() ;
}) ;

test('new Client(obj)', (t) => {
  t.plan(1);
  let client ;
  t.doesNotThrow(() => { client = new Client({localPort: 9099, localAddress: '127.0.0.1'}); }) ;
  client.close() ;
}) ;

test('new Client({}})', (t) => {
  t.plan(1);
  let client ;
  t.doesNotThrow(() => { client = new Client({}); }) ;
  client.close() ;
}) ;

test('new Client(p1, p2, p3)', (t) => {
  t.plan(1);
  t.throws(() => { new Client(9099, '127.0.0.1', 'foobar'); }) ;
}) ;

test('new Client(callback)', (t) => {
  t.plan(1);
  const client = new Client(() => {
    t.pass('listening event emitted, if callback supplied');
    client.close() ;
  });
}) ;

test('new Client(port, callback)', (t) => {
  t.plan(1);
  const client = new Client(6060, () => {
    t.pass('listening event emitted, if callback supplied');
    client.close() ;
  });
}) ;

test('new Client(obj, callback)', (t) => {
  t.plan(1);
  const client = new Client({localPort: 9099, localAddress: '127.0.0.1'}, () => {
    t.pass('listening event emitted, if callback supplied');
    client.close() ;
  });
}) ;

test('ping({port, host})', (t) => {
  t.plan(1);
  const client = new Client() ;
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngine.bind(client.socket));

  client.ping({port: 22222, host: '35.195.250.243'})
    .then((res) => {
      t.equal(res.result, 'pong', 'received \'pong\'');
      client.close();
    })
    .catch((err) => {
      client.close() ;
      t.fail(err);
    });
}) ;

test('ping(port, host)', (t) => {
  t.plan(1);
  const client = new Client() ;
  sinon.stub(client.socket, 'send')
    .callsFake(fakeRtpEngine.bind(client.socket));

  client.ping(22222, '35.195.250.243')
    .then((res) => {
      t.equal(res.result, 'pong', 'received \'pong\'');
      client.close();
    })
    .catch((err) => {
      client.close() ;
      t.fail(err);
    });
}) ;

