import uuid from 'uuid/v4'
import split from 'split2'
import { isFunction } from 'lodash'
import { PassThrough } from 'stream'
import { debug } from '../util'

const ID = Symbol('id')
const BUFFER = Symbol('buffer')
const log = debug('channel')
const logconnect = debug('channel::connection')

export default class Channel {
  /** @protected */
  constructor (transport) {
    this.outgoing = new Map()
    this.incoming = new Map()
    this.transport = transport
    this.handler = () => {
      throw new Error('Register an incoming message handler.')
    }
    this.CONCURRENCY = process.env.ZRPC_CONCURRENCY || 20
    this.connection = {
      index: 0,
      keys: [],
      pending: {}
    }
  }

  /** @protected */
  connect (client, incoming = true) {
    const id = uuid()
    const stream = new PassThrough()

    stream.pipe(split()).on('data', data => this.handler(id, data))

    logconnect('Connected: %s:%s (%s)', client.remoteAddress, client.remotePort, id)
    
    // Attach ID.
    Object.defineProperty(client, ID, {
      value: id,
      enumerable: false,
      writable: false
    })

    Object.defineProperty(client, BUFFER, {
      value: stream,
      enumerable: false,
      writable: false
    })
    
    if (incoming) this.incoming.set(id, client)
    else {
      this.outgoing.set(id, client)
      this.connection.keys.push(id)
    }
  }

  /** @protected */
  disconnect (client) {
    const id = client[ID]
    client[BUFFER].destroy()
    logconnect('Disconnected: %s:%s (%s)', client.remoteAddress, client.remotePort, id)
    if (this.incoming.has(id)) this.incoming.delete(id)
    else {
      this.outgoing.delete(id)
      this.connection.keys.splice(this.connection.keys.indexOf(id), 1)
    }
  }

  /** @private */
  use (id) {
    return this.incoming.get(id) || this.outgoing.get(id)
  }

  /** @private */
  requestOutgoingConnection () {
    const index = this.connection.index
    const key = this.connection.keys[index]

    this.connection.index = (this.connection.index + 1) % this.CONCURRENCY

    if (this.outgoing.has(key)) return this.outgoing.get(key)
    
    if (index in this.connection.pending) return this.connection.pending[index]

    logconnect('create new client = %s', index)
    const client = this.connection.pending[index] = this.createClient()

    this.connection.pending[index].then(
      () => { delete this.connection.pending[index] },
      () => { delete this.connection.pending[index] }
    )

    return this.connection.pending[index]
  }
 
  /** @protected */
  onReceive (client, message) {
    log(client[ID] + ' >> %s', message)
    client[BUFFER].write(message)
  }

  /** @protected */
  onSend (client, message) {
    throw new Error('This method should be overridden by child class.')
  }

  /** @protected */
  onError (e) {
    console.error(e && e.stack)
  }

  /** @protected */
  async createClient () {
    throw new Error('This method should be overridden by child class.')
  }
  
  /** @protected */
  async createServer () {
    throw new Error('This method should be overriden in child class.')
  }

  /** @private */
  async send$ (client, message) {
    client = await client
    message = await message
    
    log(client[ID] + ' << %s', message)
    
    this.onSend(client, message + '\n')
  }

  send (id, message) {
    if (id) {
      this.send$(this.use(id), message).catch(e => this.onError(e))
    } else {
      this.send$(this.requestOutgoingConnection(), message).catch(e => this.onError(e))
    }
  }

  register (cb) {
    if (!isFunction(cb)) throw new Error('Invalid argument passed to register method. Expecting a callback.')

    this.handler = cb
  }

  start (cb) {
    this.createServer().then(cb)
  }
}
