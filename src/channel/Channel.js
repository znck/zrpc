import uuid from 'uuid/v4'
import { isFunction } from 'lodash'
import { debug } from '../util'

const ID = Symbol('id')
const log = debug('channel')

export default class Channel {
  /** @protected */
  constructor () {
    this.outgoing = new Map()
    this.incoming = new Map()
    this.handler = () => {
      throw new Error('Register an incoming message handler.')
    }
  }

  /** @protected */
  connect (client, incoming = true) {
    // const id = uuid()
    const id = client.remoteAddress + ':' + client.remotePort

    log('Connected: ' + id)
    
    // Attach ID.
    Object.defineProperty(client, ID, {
      value: id,
      enumerable: false,
      writable: false
    })
    
    if (incoming) this.incoming.set(id, client)
    else this.outgoing.set(id, client)
  }

  /** @protected */
  disconnect (client) {
    log('Disconnected: ' + client[ID])
    this.incoming.delete(client[ID])
    this.outgoing.delete(client[ID])
  }

  /** @private */
  use (id) {
    return this.incoming.get(id) || this.outgoing.get(id)
  }

  /** @private */
  requestOutgoingConnection () {
    log('find outgoing client')
    const client = this.outgoing.values().next().value

    if (client) return client

    return this.createClient()
  }
 
  /** @protected */
  onReceive (client, message) {
    log(client[ID] + ' >> %s', message)
    this.handler(client[ID], message)
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
    
    this.onSend(client, message)
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
