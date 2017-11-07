import test from 'ava'
import Channel from './Channel'

test(`'connect' & 'disconnect' workflow`, t => {
  const channel = new Channel()

  const outgoing = { name: 'out' }
  const incoming = { name: 'in' }

  channel.connect(incoming)
  channel.connect(outgoing, false) // outgoing.

  t.is(incoming, channel.incoming.values().next().value)
  t.is(outgoing, channel.outgoing.values().next().value)
  
  channel.disconnect(incoming)
  channel.disconnect(outgoing)

  t.is(0, channel.incoming.size)
  t.is(0, channel.outgoing.size)
})

test(`'receive' & 'send' workflow`, t => {
  const channel = new Channel()
  const incoming = { name: 'in' }
  
  let id, message

  channel.register((...params) => { [id, message] = params })
  channel.connect(incoming)

  channel.onReceive(incoming, '{}\n')

  t.is('{}', message)

  let sent

  channel.onSend = (c, message) => {
    t.is(incoming, c)
    t.is('foo', message)
  }

  channel.use = (key) => {
    t.is(id, key)

    return incoming
  }

  channel.send(id, 'foo')
})

test.cb(`'createClient' workflow`, t => {
  const channel = new Channel()
  const outgoing = { name: 'out' }

  channel.createClient = async () => {
    channel.connect(outgoing, false)

    return outgoing
  }

  channel.onSend = (client, message) => {
    t.is(outgoing, client)
    t.is('foo\n', message)
    t.end()
  }

  channel.send(null, 'foo')
})
