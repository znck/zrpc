import parse from 'json-parse-stream'
import { isBuffer } from 'lodash'

export async function encode(message) {
  return JSON.stringify(message)
}

export async function decode(source) {
  try {
    if (isBuffer(source)) {
      source = source.toString()
    }
  
    return JSON.parse(source)
  } catch (e) {
    console.log(source)
    console.error(e)

    throw e
  }
}
