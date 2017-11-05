import uuid from 'uuid/v4'
import TCP from './TCP'

export default function channel (type, options) {
  switch (type) {
    case 'tcp': 
    default: 
      return new TCP(options)
  }
}
