import * as transport from './transport'
import channel from './channel'
import RPC from './rpc'
import { isFunction, isPlainObject } from 'lodash'

export function server (type, options) {
  return new RPC({
    channel: channel(type, { server: options || true }),
    transport
  })
}

export function client (type, options) {
  if (!options.host) throw new Error('Remote host is required.')

  return new RPC({
    channel: channel(type, { client: options }),
    transport
  })
}

export default function Z (...args) {
  const first = args[0]
  const last = args.slice(-1).pop()
  const options = isPlainObject(last) ? last : {}

  const type = options.type

  delete options.type

  if (isFunction(first)) {
    const s = server(type, options)

    s.register(...args)

    return s
  }

  return client(type, options)
}
