import uuid from 'uuid/v4'
import { Server, Socket } from 'net'
import { isFunction } from 'lodash'
import debug from 'debug'

const LOGGER = debug('zrpc::channel')

export default function channel (type, options) {
  switch (type) {
    case 'tcp': 
    default: 
      return new TCP(options)
  }
}

export class Channel {
  constructor (server, client) {
    this.server = server
    this.client = client
    this.clients = new WeakMap()
    this.handler = () => console.warn('Register a message handler using onMessage method.')

    client && client.data(buffer => this.handler(buffer, null))
  }

  onMessage (handler) {
    if (!isFunction(handler)) throw new Error('A callback function is expected.')

    this.handler = handler
  }

  send (clientId, message) {
    LOGGER(`send :: clientId=%s, message=%o`, clientId, message)
    if (clientId === null && this.client) {
      this.client.send(message)

      return // done.
    }

    const client = this.clients[clientId]

    if (!client) {
      console.log('Connection not found: ' + clientId)

      return // done.
    }

    client.send(message)
  }

  listen (port) {
    if (!this.server) throw new Error('This channel cannot start a server.')

    this.server.listen(port, () => {
      console.log('Listening on port ' + port)
    })
  }

  _onConnection (client) {
    this.clients[client.name] = client
  
    client.data(buffer => this.handler(buffer, client.name))
  }

  _onDisconnection (client) {
    delete this.clients[client.name]
  }
}

export class TCP extends Channel {
  constructor (options = {}) {
    const handler = socket => {
      const client = {
        name: socket.remoteAddress + ':' + socket.remotePort, // + '#' + uuid(),
        data: fn => socket.on('data', fn),
        send: data => socket.write(data)
      }
      
      this._onConnection(client)

      socket.on('close', () => this._onDisconnection(client))
      socket.on('end', () => this._onDisconnection(client))
      socket.on('error', () => this._onDisconnection(client))
    }

    const factory = () =>  {
      const socket = new Socket()
      let active = false
      let connecting = false
      const connect = () => {
        connecting = true
        socket.connect({ port: 80, ...options.client })
      }
      const pending = []
      const client = {
        data: fn => socket.on('data', fn),
        send: data => {
          if (active) socket.write(data)
          else {
            pending.push(data)
            connect()
          }
        }
      }
      const flush = () => {
        while (pending.length) {
          client.send(pending.shift())
        }
      }
      
      socket.on('connect', () => { connecting = false; active = true; flush() })
      socket.on('close', () => { connecting = active = false }) 
      socket.on('error', () => { connecting = active = false }) 
      socket.on('end', () => { connecting = active = false }) 

      return client
    }
    
    const server = options.server ? new Server(handler) : null
    const client = options.client ? factory() : null

    super(server, client)
  }
}
