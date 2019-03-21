# rtpengine-client [![Build Status](https://travis-ci.org/davehorton/rtpengine-client.svg?branch=master)](http://travis-ci.org/davehorton/rtpengine-client) [![NPM version](https://badge.fury.io/js/rtpengine-client.svg)](http://badge.fury.io/js/rtpengine-client) [![Coverage Status](https://coveralls.io/repos/github/davehorton/rtpengine-client/badge.svg?branch=master)](https://coveralls.io/github/davehorton/rtpengine-client?branch=master)

A Promises-based nodejs client for accessing rtpengine via ng protocol

## Usage

```js
const Client = require('rtpengine-client').Client ;
const client = new Client() ;

client.ping(22222, '39.194.250.246')
  .then((res) => {
    console.log(`received ${JSON.stringify(res)}`); // {result: 'pong'}
  })
  .catch((err) => {
    console.log(`Error: ${err}`);
  }
}
```  

## Constructing a client 
```js
client = new Client() ;  // listen on any port and default address
// or..
client = new Client(9055);    // listen on a specific port
// or..
client = new Client(9055, '192.168.1.10'); // listen on a specific port and address
// or..
client = new Client({port: 9055, host: '192.168.1.10'}); // listen on a specific port and address
// or..
client = new Client({timeout: 1500}); // wait a max of 1500 ms for each command reply, throw error on timeout
// or..
client = new Client({rejectOnFailure: true}); 
// reject promise on any command if response from rtpengine has error 
// default behavior is to resolve with any response from rtpengine, even errors
```

## Making requests
The ng request verbs (`ping`, `offer`, `answer`, `delete`, `query`, `start recording`, `stop recording`, `block DTMF`, `unblock DTMF`, `block media`, `unblock media`) are available as methods on the `client` object.  The sytax for each is the same:
+ the destination of the request comes first, either as `port, host` or `{port, host}`
+ following that, if any options are required for the request, those come next in an object.

The function call returns a promise that is resolved when the response is received.

Function names are as follows:

| ng verb         | function name |
|----------------|----------------|
|ping            | ping           |
|offer           | offer          |
|answer          | answer         |
|delete          | delete         |
|query           | query          |
|start recording | startRecording |
|stop recording  | stopRecording  |
|block DTMF      | blockDTMF      |
|unblock DTMF    | unblockDTMF    |
|block media     | blockMedia     |
|unblock media   | unblockMedia   |

For instance
```
client.offer(22222, '35.195.250.243', {
  'sdp': ..
  'call-id': ..
  'from-tag': ..
})
  .then((res) => {
    console.log(res); // { "result": "ok", "sdp": "v=0\r\no=..." }
  })
  .catch((err) => {

  });

// or..
client.offer({port: 22222, host: '35.195.250.243}, {
  'sdp': ..
  'call-id': ..
  'from-tag': ..
}) // ...etc
```