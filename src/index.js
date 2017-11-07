import * as transport from './transport'
import channel from './channel'
import RPC from './rpc'
import { isFunction, isPlainObject } from 'lodash'
import { debug } from './util'

const log = debug('main')

function create (type, options) {
  return new RPC({ channel: channel(type, options), transport })
}

function ZUtil (rpc) {
  log('create a proxy client')

  return new Proxy({}, {
    get: (target, key) => {
      log(`proxy: get ${key} method.`)
      switch (key) {
        case 'rpc': return rpc
        case 'rpcCall': return (method, ...args) => rpc.invoke(method, args)
        case 'rpcNotify': return (method, ...args) => rpc.notify(method, args)
        default: return (...args) => rpc.invoke(key, args)
      }
    }
  })
}

function Z (...args) {
  const first = args[0]
  const last = args.slice(-1).pop()
  
  const options = isPlainObject(last) ? last : {}
  const type = options.type

  delete options.type

  if (isFunction(first)) {
    const s = create(type, options)

    s.register(...args)

    return s
  }

  return ZUtil(create(type, options))
}

module.exports = exports = Z

exports.Z = Z
