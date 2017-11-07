import Channel from './Channel'
import { connect, Server } from 'tls'
import { readFileSync } from 'fs'
import { debug, toArray } from '../util'

const log = debug('channel:tls')

export default class TLS extends Channel {
  constructor(options) {
    super()

    this.options = options
  }

  /** @private */
  async createServer () {
    const events = ['close', 'end', 'error']
    const host = process.env.ZRPC_HOST || this.options.host || '0.0.0.0'
    const port = process.env.ZRPC_PORT || this.options.port || 445
    const options = { ...this.options }

    if (!('ca' in options) && process.env.ZRPC_TLS_CA) options.ca = [
      readFileSync(process.env.ZRPC_TLS_CA)
    ]
    if (!('key' in options) && process.env.ZRPC_TLS_KEY)
      options.key = readFileSync(process.env.ZRPC_TLS_KEY)
    if (!('cert' in options) && process.env.ZRPC_TLS_CERT)
      options.cert = readFileSync(process.env.ZRPC_TLS_CERT)

    const server = new Server(socket => {
      if (!socket.authorized) log('Unauthorised connection to %s:%s', socket.remoteAddress, socket.remotePort)

      this.connect(socket)

      socket.on('data', data => this.onReceive(socket, data))
      
      events.forEach(event => socket.on(event, (error) => {
        this.disconnect(socket)
        
        if (error instanceof Error) this.onError(error)
      }))
    })
    server.addContext(host, options)

    // start the server.
    log('Start server on %s:%s', host, port)
    server.listen(port, host)

    return server
  }

  /** @private */
  async createClient () {
    log('create tls client')
    const events = ['close', 'end', 'error']
    const socket = new TLSSocket()

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
}
