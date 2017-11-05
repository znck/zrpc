import test from 'ava'
import { Readable } from 'stream'
import { decode } from './transport'

test(`'decode' should parse`, async t => {
  const d = await decode('{"foo":"bar"}')
  
  t.deepEqual({ foo: 'bar' }, d)
})
