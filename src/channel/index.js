import uuid from 'uuid/v4'
import TCP from './TCP'
import TLS from './TLS'

function detect (options) {
  if (['key', 'ca', 'cert'].some(key => key in options)) return 'tls'

  return 'tcp'
}

export default function channel (type, options) {
  type = type || detect(options)

  switch (type) {
    case 'tcp': return new TCP(options)
    case 'tls': return new TLS(options)
  }
}
