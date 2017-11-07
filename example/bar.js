const { Z } = require('../lib')

const app = Z({ host: 'localhost', port: 8080 })

setTimeout(
  async () => console.log(
    await app.hello(
      'Rahul', 
      async (any, cb) => { 
        return any + ' How are you? ' + await cb('Cool!')
      }
    )
  ), 1000
)
