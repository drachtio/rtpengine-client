class RtpEngineError extends Error {
  constructor(...args) {
    super(...args);
    Error.captureStackTrace(this, RtpEngineError);
  }
}

module.exports = RtpEngineError;
