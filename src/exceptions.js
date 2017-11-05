import { isError } from 'lodash'
export class RPCException extends Error {
  constructor (code, message, error) {
    super()
    this.message = message
    this.code = code
    this.data = isError(error) ? error.stack : error
  }
}

export class ParseErrorException extends RPCException {
  constructor (error) {
    super(-32700, 'Parse Error', error)
  }
}

export class InvalidRequestException extends RPCException {
  constructor (error) {
    super(-32600, 'Invalid Request', error)
  }
}

export class MethodNotFoundException extends RPCException {
  constructor (error) {
    super(-32601, 'Method not found', error)
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
