const Z = require('../lib')
const { range } = require('lodash')

process.on('unhandledRejection', error => {
  console.error(error)
  console.log(error.data)
})

const app = Z({ host: 'localhost', port: 8000 })

function print(t, i) {
  return (t[0] + 's ' + (t[1] / 1000000) + 'ms')
}

function printns (s) {
  return print([Math.floor(s / 1e9), s % 1e9])
}

const N = 40000
const r = range(N)
const bench = () => {
  const start = process.hrtime()
  return Promise.all(
    r.map(
      async i => {
        const start = process.hrtime()
    
        await app.hello('Foo')
    
        return process.hrtime(start)
      }
    )
  ).then(
    results => {
      const end = process.hrtime(start)
      console.log('-------------------------')
      console.log('TIME:',  print(end))
      console.log('AVG: ',  printns(results.reduce(
        (s, i) => s + (i[0] * 1e9) + i[1], 0
      ) / N))
      console.log('CPS:', Math.floor(N / (end[0] + end[1] / 1e9)))
      console.log('CALL:', N)
    }
  )
}

range(10).reduce(p => p.then(bench), bench())
