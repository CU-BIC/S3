
class APILimitError extends Error {
  constructor(api, apiKey, ...args) {
    super(...args);
    this.time = new Date();
    this.api = api;
    this.message = `Calls to the ${api} API are exhausted for the API key provided: ${apiKey} .`;
    this.code = 'APILIMIT';

    if (Error.captureStackTract) {
      Error.captureStackTrac(this, APILimitError);
    }
  }
}

module.exports = APILimitError;