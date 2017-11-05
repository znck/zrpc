import Channel from './Channel'
import { Server, Socket } from 'net'
import { debug } from '../util'

const log = debug('channel:tcp')

export default class TCP extends Channel {
  constructor (options) {
    super()

    this.options = options
  }

  /** @private */
  async createServer () {
    const events = ['close', 'end', 'error']
    const server = new Server(socket => {
      this.connect(socket)

      socket.on('data', data => this.onReceive(socket, data))

      events.forEach(event => socket.on(event, (error) => {
        this.disconnect(socket)
        
        if (error instanceof Error) this.onError(error)
      }))
    })

    // start the server.
    log('Start server on %s:%s', process.env.ZRPC_HOST || this.options.host || '0.0.0.0', process.env.ZRPC_PORT || this.options.port || 80)
    server.listen(
      process.env.ZRPC_PORT || this.options.port || 80,
      process.env.ZRPC_HOST || this.options.host || '0.0.0.0'
    )

    return server
  }

  /** @private */
  async createClient () {
    log('create tcp client')
    const events = ['close', 'end', 'error']
    const socket = new Socket()

    socket.on('data', data => this.onReceive(socket, data))

    events.forEach(event => socket.on(event, (error) => {
      this.disconnect(socket)
      
      if (error instanceof Error) this.onError(error)
    }))

    // connect to server.
    socket.connect({
      host: this.options.host,
      port: this.options.port
    })

    return new Promise(
      (resolve, reject) => socket.on('connect', () => {
        this.connect(socket, false)
        
        resolve(socket)
      })
    )
  }

  /** @private */
  onSend (socket, message) {
    if (!socket) throw new Error('No TCP socket found.')

    socket.write(message)
  }
}