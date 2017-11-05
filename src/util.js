import _debug from 'debug'
import { isFunction } from 'lodash'

export function debug (name) {
  return _debug(`zrpc::${name}`)
}

const COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg
const FAT_ARROWS = /=>.*$/mg
export function parameters (fn) {
  if (!isFunction(fn)) return []

  return fn.toString()
    .replace(COMMENTS, '')
    .replace(FAT_ARROWS, '')
    .slice(fn.indexOf('(') + 1, fn.indexOf(')'))
    .match(/([^\s,]+)/g)
    .map(parameter => {
      const parts = parameter.split('=')

      return { name: parts[0], optional: parts.length > 1 }
    })
}
