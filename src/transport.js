import parse from 'json-parse-stream'
import { Stream } from 'stream'

export async function encode(message) {
  return JSON.stringify(message)
}

export async function decode(source) {
  if (source instanceof Stream) {
    return new Promise((resolve, reject) => {
      source
        .pipe(parse())
        .on('data',result => resolve(result))
        .error('error', error => reject(error))
    })
  }

  return JSON.parse(source)
}
