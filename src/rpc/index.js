import { debug, parameters } from '../util'
import * as dnode from '../dnode'
import * as exceptions from '../exceptions'
import uuid from 'uuid/v4'
import { isPlainObject, isFunction, isNumber, isString, each } from 'lodash'

const log = debug('rpc')

const METHODS = Symbol('methods')
const CALLS = Symbol('calls')

const createProperty = (value) => ({ value, writable: false, enumerable: false })

export default class RPC {
  constructor ({ channel, transport }) {
    channel.register((client, message) => this.handleMessage(client, message))

    this.channel = channel
    this.transport = transport

    Object.defineProperty(this, METHODS, createProperty({}))
    Object.defineProperty(this, CALLS, createProperty({}))
  }

  /** @private */
  get methods () {
    return this[METHODS]
  }

  /** @private */
  get calls () {
    return this[CALLS]
  }

  /** @private */
  handleMessage (client, message) {
    this.transport.decode(message)
      .then(data => this.handle(client, data))
      .catch(error => this.sendError(client, this.tryParse(message), null, new exceptions.ParseErrorException(error)))
  }

  /** @private */
  tryParse (message) {
    const matches = message.toString().match(/(?:"id":[\s]*")([^"]*)/)

    return matches && matches[1]
  }

  /** @private */
  handle (client, data) {
    if (!isPlainObject(data)) this.sendError(client, data.id, data.method, new exceptions.InvalidRequestException(data))

    if ('method' in data) {
      log('--- message = %o from %s', data, client)
      this
        .receiveCall(client, data)
        .catch(error => this.sendError(client, data.id, data.method, error))
    } else {
      this
        .receiveResult(client, data)
        .catch(error => this.sendError(client, data.id, null, error))
    }
  }

  /** @private */
  async receiveCall (client, data) {
    const [ method, params ] = dnode.decode(
      data, 
      method => 
        (...params) => this.makeCall({ client, method, params, data })
    )

    const meta = this.calls[data._id || data.id] // for callbacks, base request is in _id.
    const result = await this.exec(method, params, meta || { data })

    this.sendResult(client, data.id, method, result)
  }

  /** @private */
  async receiveResult (client, data) {
    const call = this.calls[data.id]

    if (!call) return // No one is expecting a response.

    log(`Receive result from ${client}. result = %o `, data)

    call.onResult(data.error, data.result)

    delete this.calls[data.id]
  }

  /** @private */
  exec (name, params, { callbacks }) {
    const methods = isNumber(name) ? callbacks : this.methods

    if (!(name in methods)) throw new exceptions.MethodNotFoundException(`No method name '${name}' found.`)

    const fn = methods[name]
    const result = fn(...params)
    log('params %o handler %s --- %o', params, fn.toString(), result)

    return result
  }

  /** @private */
  makeCall ({ client, method, params, data }) {
    const id = uuid()
    let onResult
    const promise = new Promise((resolve, reject) => {
      onResult = (error, result) => {
        if (error) { reject(error) } else { resolve(result) }
      }
    })

    const callbacks = {}
    const payload = { id, jsonrpc: '2.0', ...dnode.encode(method, params) }
    
    this.calls[id] = { id, client, method, params, callbacks, onResult: onResult }
    each(payload.callbacks, (key, cb) => { callbacks[cb] = key.reduce((t, i) => t[i], params) })

    if (data) {
      payload._id = data.id
    }

    log(`Call %o with %o (c=%s request=%s)`, method, params, data && data.id, id)

    this.channel.send(client, this.transport.encode(payload))

    return promise
  }

  /** @private */
  async sendResult (client, id, method, result) {
    if (!id) return // A notification. No response is expected.

    log(`${id}: Result = %o`, result)

    this.channel.send(client, await this.transport.encode({ id, jsonrpc: '2.0', result }))
  }
  
  /** @private */
  sendError (client, id, method, error) {
    log(`${id}: Failed. Error = %o`, error)
    
    if (!id) return // A notification. No response is expected.

    this.channel.send(client, this.transport.encode({ id, jsonrpc: '2.0', error }))
  }

  run (cb) {
    this.channel.start(cb)
  }

  notify (method, params) {
    this.invoke(method, params)
  }

  invoke (method, params) {
    return this.makeCall({ method, params })
  }

  register (...args) {
    // Check for object registeration.
    if (isPlainObject(args[0])) {
      each(args[0], (value, key) => this.register(key, value))

      return // done.
    }

    // Check for mulitple closures registeration.
    if (isFunction(args[0])) {
      args
        .filter(isFunction)
        .forEach(fn => this.register(fn.name, fn))

      return // done.
    }

    // Default. Single function with name.
    const [name, handler] = args

    if (!isString(name) || name === '') throw new Error('Invalid method name.')
    if (/^rpc/i.test(name)) throw new Error(`'${name}' is a reserved keyword.`)
    if (!isFunction(handler)) throw new Error('A handler function is requried.')

    this[METHODS][name] = handler
  }
}
