import * as dnode from './dnode'
import uuid from 'uuid/v4'
import { isFunction, isString, isPlainObject, isNumber, each } from 'lodash'
import {
  RPCException,
  ParseErrorException,
  MethodNotFoundException,
  InvalidParamsException,
  InternalErrorException
} from './exceptions'
import debug from 'debug'

const LOGGER = debug('zrpc::rpc')

const COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg
const FAT_ARROWS = /=>.*$/mg

function toArray (any) {
  return Array.isArray(any) ? any : [ any ]
}

export default class RPC {
  constructor ({ channel, transport }) {
    this.channel = channel
    this.transport = transport
    this.methods = {}
    this.requests = {}
    this.collectors = {}

    this.channel.onMessage((message, client) => {
      try {
        this._onMessage(message, client)
      } catch (e) {
        console.error(e)
      }
    })
  }

  listen (...args) {
    this.channel.listen(...args)
  }

  // --- DEFINE SERVER METHODS ---

  register (name, handler, ...rest) {
    if (isPlainObject(name)) {
      each(name, (value, key) => this.register(key, value))

      return // done.
    }

    if (isFunction(name)) {
      [name, handler, ...rest]
        .filter(isFunction)
        .forEach(fn => this.register(fn.name, fn))

      return // done.
    }

    if (!isString(name) || name === '') throw new Error('Invalid method name.')
    if (/^rpc/i.test(name)) throw new Error(`'${name}' is a reserved keyword.`)
    if (!isFunction(handler)) throw new Error('A handler function is requried.')

    this.methods[name] = this._descriptor(handler)
  }

  // --- HANDLE INCOMING REQUESTS ---

  async _onMessage (buffer, clientId) {
    LOGGER('onMessage :: clientId=%s', clientId)
    let data

    try {
      data = await this.transport.decode(buffer)
    } catch (e) {
      if ('id' in data) {
        this._respond(clientId, data.id, new ParseErrorException())
      }

      return // can't process the request.
    }

    // TODO: Verify JSON-RPC version.

    if ('method' in data) { // New request.
      LOGGER('onMessage :: request data=%o', data)
      const [method, params] = dnode.decode(
        data, 
        cb => (...params) => this._send(data.id, cb, params, clientId)
      )
      const message = {
        ...data,
        method, params
      }
      LOGGER('onMessage :: request message=%o', message)
      this._onRequest(message, clientId).catch(
        e => this._respond(clientId, message.id, e instanceof RPCException ? e : new InternalErrorException(e))
      )
    } else { // Response for some request.
      LOGGER('onMessage :: response data=%o', data)
      this._onResponse(data)
    }
  }

  async _respond (clientId, id, error, result) {
    LOGGER('response :: clientId=%s id=%s', clientId, id)
    if (!id) return // For falsy id, response is not requried.

    const message = { id, jsonrpc: '2.0', error, result }

    this.channel.send(clientId, await this.transport.encode(message))
  }

  _callback (name, params, request) {
    LOGGER('callback :: method=%s, request=%o', name, request)

    return this._exec((request && request.callbacks) || [], name, params)
  }

  _handle (name, params) {
    return this._exec(this.methods, name, params)
  }

  _descriptor (handler) {    
    LOGGER('descriptor :: type = %s', typeof handler)
    if (isFunction(handler)) {
      LOGGER('descriptor :: add description to ' + handler.toString())
      const fn = handler.toString()
      .replace(COMMENTS, '')
      .replace(FAT_ARROWS, '')
      
      return {
        handler,
        required: fn.slice(fn.indexOf('(') + 1, fn.indexOf(')'))
          .match(/([^\s,]+)/g)
          .filter(arg => !/=/.test(arg))
      }
    }

    return handler
  }

  async _exec (methods, name, params) {
    LOGGER('exec :: method=%s, params=%o', name, params)
    if (!(name in methods)) {
      throw new MethodNotFoundException()
    }

    const method = this._descriptor(methods[name])

    LOGGER('exec :: call ' + method)

    if (method.required.length < params.length) {
      LOGGER('exec :: params chack failed ')
      throw new InvalidParamsException('Missing values for requires parameters.')
    }

    LOGGER('exec :: calling ' + method.handler)

    try {
      return await method.handler(...params)
    } catch (e) {
      throw new InternalErrorException(e)
    }
  }

  _collect (id, cb) {
    // TODO: Process through middlewares.
    LOGGER('collect :: collect id=%s', id)
    this.collectors[id] = cb
  }

  // --- HANDLE OUTGOING REQUESTS ---

  async notify (method, params) {
    await this._send(null, method, params, null)
  }

  async request (method, params) {
    const id = uuid()
    
    return this._send(id, method, params, null)
  }

  async _send (id, method, params, clientId = null) {
    let result

    const message = { id, jsonrpc: '2.0', ...dnode.encode(method, toArray(params)) }
    const isNotification = id === null
    
    if (isNotification) {
      delete message.id
    } else {
      this.requests[id] = dnode.callbacks({ ...message, params })
      result = new Promise((resolve, reject) => {
        this._collect(id, (error, result) => error ? reject(error) : resolve(result))
      })
    }
    
    this.channel.send(clientId, await this.transport.encode(message))

    return result
  }

  // --- ON EVENTS ---
  async _onRequest (message, clientId) {
    LOGGER('onRequest :: call=%s', message.method)
    if (isString(message.method)) {
      LOGGER('onRequest :: method called')
      this._respond(clientId, message.id, null, await this._handle(message.method, message.params))
    } else if (isNumber(message.method)) {
      LOGGER('onRequest :: callback called')
      const request = this.requests[message.id]

      this._respond(clientId, message.id, null, await this._callback(message.method, message.params, request))
    }
  }

  _onResponse (message) {
    const request = this.requests[message.id]
    LOGGER('onResponse :: message=%s request=%o', message.id, request)

    if (!request) return // done.

    const collector = this.collectors[message.id]

    LOGGER('onResponse :: message=%s collector=%o', message.id, collector)

    if (isFunction(collector)) {
      LOGGER('onResponse :: call collector')
      collector(message.error, message.result)

      delete this.collectors[message.id]
    }

    delete this.requests[message.id]
  }
}
