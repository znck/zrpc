import test from 'ava'
import RPC from './'

test.cb(`make call`, t => {
  const channel = { register () {}, send () {} }
  const transport = { encode: async i => JSON.stringify(i), decode: async i => JSON.parse(i) }
  const rpc = new RPC({ channel, transport })
  rpc.register(function foo (val) {
    t.is('bar', val)
    t.end()
  })

  rpc.handleMessage('1', JSON.stringify({ id: 1, method: 'foo', params: ['bar'] }))
})