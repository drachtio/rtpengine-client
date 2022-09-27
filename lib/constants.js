const _commands = {
  'answer': 'answer',
  'delete': 'delete',
  'list': 'list',
  'offer': 'offer',
  'ping': 'ping',
  'query': 'query',
  'startRecording': 'start recording',
  'stopRecording': 'stop recording',
  'blockDTMF': 'block DTMF',
  'unblockDTMF': 'unblock DTMF',
  'playDTMF': 'play DTMF',
  'blockMedia': 'block media',
  'unblockMedia': 'unblock media',
  'silenceMedia': 'silence media',
  'unsilenceMedia': 'unsilence media',
  'startForwarding': 'start forwarding',
  'stopForwarding': 'stop forwarding',
  'playMedia': 'play media',
  'stopMedia': 'stop media',
  'statistics': 'statistics',
  'publish': 'publish',
  'subscribeRequest': 'subscribe request',
  'subscribeAnswer': 'subscribe answer',
  'unsubscribe': 'unsubscribe'
};

const COMMANDS = Object.keys(_commands);

const getRtpEngineNameForCommand = (name) => _commands[name];

module.exports = {
  COMMANDS,
  getRtpEngineNameForCommand
};
