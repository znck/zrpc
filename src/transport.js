import parse from 'json-parse-stream'
import { Readable } from 'stream'

export async function encode(message) {
  return JSON.stringify(message)
}

export async function decode(source) {
  if (source instanceof Buffer) {
    source = source.toString()
  }

  return JSON.parse(source)
}
