import { each } from 'lodash'

function scrub (arg, key, dnode, cid) {
  switch (typeof arg) {
    case 'object':
      if (!arg) return arg
      
      const match = dnode.objects.find(
        ({ target }) => target === arg
      )

      if (match) {
        dnode.links.push({ from: match.key, to: key })

        return null
      }

      dnode.objects.push({ key, target: arg })
      
      if (Array.isArray(arg)) return arg.map(
        (item, i) => scrub(item, [...key, i], dnode, cid)
      )
      
      return Object.entries(arg).reduce(
        (result, [i, item]) => ({
          [i]: scrub(item, [...key, i], dnode, cid),
          ...result
        }), {}
      )
    
    case 'function':
      dnode.callbacks[cid()] = key
    
      return '[Function]'
    
    default:
      return arg === undefined ? null : arg
  }
}

export function encode (method, args) {
  const dnode = { method, params: [], callbacks: {}, links: [], objects: [] }
  let cid = 0
  
  args.forEach((arg, i) => {
    dnode.params.push(
      scrub(arg, [i], dnode, () => cid++)
    )
  })

  delete dnode.objects

  return dnode
}

export function callbacks (dnode) {
  const callbacks = {}
  function get (key) {
    return key.reduce((target, i) => target && target[i], dnode.params)
  }

  each(dnode.callbacks, (cb, key) => {
    callbacks[key] = get(cb)
  })

  return { ...dnode, callbacks }
}

export function decode (dnode, handle) {
  const result = dnode.params.slice()

  function get (key) {
    return key.reduce((target, i) => target && target[i], result)
  }

  function set (key, value) {
    key = key.slice()
    const last = key.pop()
    const target = get(key)

    if (target) target[last] = value
  }

  Object.entries(dnode.callbacks).forEach(
    ([callback, key]) => set(key, handle(Number(callback)))
  )

  dnode.links.forEach(
    link => set(link.to, get(link.from))
  )

  return [dnode.method, result]
}
