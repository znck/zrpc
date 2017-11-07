import { debug, parameters, toArray } from '../util'
import * as dnode from '../dnode'
import * as exceptions from '../exceptions'
import uuid from 'uuid/v4'
import split from 'split2'
import { PassThrough } from 'stream'
import { isPlainObject, isFunction, isNumber, isString, each, isEmpty } from 'lodash'

const log = debug('rpc')
const _id = any => any.slice(-4)

const METHODS = Symbol('methods')

const createProperty = (value) => ({ value, writable: false, enumerable: false })

export default class RPC {
  constructor ({ channel, transport }) {
    channel.register((client, message) => this.handleMessage(client, message))

    this.channel = channel
    this.transport = transport
    this.channel.transport = transport

    this.incoming = {}
    this.outgoing = {}

    Object.defineProperty(this, METHODS, createProperty({}))
  }

  /** @private */
  get methods () {
    return this[METHODS]
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
    const id = data.id
    const [ m, params ] = dnode.decode(
      data, 
      method => 
        (...params) => this.makeCall({
          id: uuid(),
          client,
          method: [method, data.id],
          params,
          initiator: data.id
        })
    )

    log(`exec (%s) method = %o params = %o`, _id(id), m, params)
    
    const [ method, initiator ] = toArray(m)
    const result = await this.exec(method, params, this.outgoing[initiator])

    this.sendResult(client, data.id, method, result)
  }

  /** @private */
  async sendResult (client, id, method, result) {
    if (!id) {
      log(`return (%s) Result = void`, _id(id))

      return // A notification. No response is expected.
    }

    log(`return (%s) Result = %o`, _id(id), result)

    this.channel.send(client, await this.transport.encode({ id, result }))
  }
  
  /** @private */
  sendError (client, id, method, error) {
    log(`return (%s) Error = %o`, _id(id), error)
    
    if (!id) return // A notification. No response is expected.

    this.channel.send(client, this.transport.encode({ id, error }))
  }

  /** @private */
  async receiveResult (client, data) {
    const call = this.outgoing[data.id]

    log(`= (%s) Result = %o Error = %o`, _id(data.id), data.result, data.error)

    if (!call) return // No one is expecting a response.

    call.onResult(data.error, data.result, data.id)

    delete this.outgoing[data.id]
  }

  /** @private */
  exec (name, params, { callbacks } = { callbacks: {} }) {
    const methods = isNumber(name) ? callbacks : this.methods

    if (!(name in methods)) throw new exceptions.MethodNotFoundException(`No method name '${name}' found.`)

    const fn = methods[name]

    log('%s', fn.toString())

    return fn(...params)
  }

  makePayload (id, method, params) {
    if (id) return { id, ...dnode.encode(method, params) }

    return dnode.encode(method, params)
  }

  /** @private */
  makeCall ({ id, client, method, params, initiator }) {    
    const payload = this.makePayload(id, method, params)
    const callbacks = {}
    const meta = {
      client,
      method, params,
      callbacks,
      onResult: () => {}
    }

    each(payload.callbacks, (key, cb) => { callbacks[cb] = key.reduce((t, i) => t[i], params) })

    if (!isEmpty(callbacks)) payload.id = uuid()

    this.outgoing[payload.id] = meta

    log(`call (%s) method = %o params = %o`, _id(payload.id), method, params)

    return new Promise((resolve, reject) => {
      this.channel.send(client, this.transport.encode(payload))
      
      meta.onResult = (err, res) => {
        if (err) { reject(err) } else { resolve(res) }
      }

      if (!payload.id) resolve()
    })
  }

  run (cb) {
    this.channel.start(cb)
  }

  notify (method, params) {
    return this.makeCall({ method, params })
  }

  invoke (method, params) {
    return this.makeCall({ id: uuid(), method, params })
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
