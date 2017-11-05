export class RPCException extends Error {
  constructor (code, message, error) {
    super()
    this.message = message
    this.code = code
    this.data = error && error.stack
  }
}

export class ParseErrorException extends RPCException {
  constructor () {
    super(-32700, 'Parse Error')
  }
}

export class InvalidRequestException extends RPCException {
  constructor () {
    super(-32600, 'Invalid Request')
  }
}

export class MethodNotFoundException extends RPCException {
  constructor () {
    super(-32601, 'Method not found')
  }
}

export class InvalidParamsException extends RPCException {
  constructor (error) {
    super(-32602, 'Invalid params', error)
  }
}

export class InternalErrorException extends RPCException {
  constructor (error) {
    super(-32603, 'Internal error', error)
  }
}
