import test from 'ava'
import { Suite } from 'benchmark'

import { encode, decode } from './dnode'

test(`'encode' should transform simple object`, t => {
  const args = [1, 'bar', { foo: 'bar' }, [ 'foo', 'bar' ]]
  const dnode = encode('foo', args)

  t.snapshot(dnode)
  t.false(args === dnode.params)
  t.is('foo', dnode.method)
  t.falsy(dnode.callbacks)
  t.falsy(dnode.links)

  t.snapshot(encode('foo', 'bar'))
})

test(`'encode' should extract callbacks`, t => {
  const args = [ foo => foo, { a: foo => foo } ]
  const dnode = encode('foo', args)

  t.snapshot(dnode)
  t.deepEqual([0], dnode.callbacks[0])
  t.deepEqual([1, 'a'], dnode.callbacks[1])
})

test(`'encode' should extract cyclic references`, t => {
  const foo = { a: 'a' }
  const args = [ foo, { a: foo } ]
  const dnode = encode('foo', args)

  t.snapshot(dnode)
  t.is(1, dnode.links.length)
  t.deepEqual({ from: [ 0 ], to: [ 1, 'a' ] }, dnode.links[0])
})

test(`'decode' should restore simple object`, t => {
  const args = [1, 'bar', { foo: 'bar' }, [ 'foo', 'bar' ]]
  const result = decode(encode('foo', args))

  t.is('foo', result[0])
  t.deepEqual(args, result[1])
})

test(`'decode' should restore callbacks`, t => {
  const args = [ foo => foo, { a: foo => foo } ]
  const result = decode(
    encode('foo', args),
    i => () => i
  )

  t.is(0, result[1][0]())
  t.is(1, result[1][1].a())
})

test(`'decode' should restore cyclic references`, t => {
  const foo = { a: 'a' }
  const args = [ foo, { a: foo } ]
  const result = decode(encode('foo', args))

  t.deepEqual(foo, result[1][0])
  t.deepEqual(foo, result[1][1].a)
  t.is(result[1][0], result[1][1].a)
})

test(`'decode' throws invalid dnode`, t => {
  t.throws(() => decode({ callbacks: [] }))
})
