const { Z } = require('../lib')

process.on('unhandledRejection', r => console.log(r))

const app = Z(
  function hello (name, cb) {
    return cb(`Hello ${name}!`)
  }, 
  { port: 8081 }
)

app.run(
  () => console.log('Foo is listening...')
)
