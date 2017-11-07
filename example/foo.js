const { Z } = require('../lib')

process.on('unhandledRejection', r => console.log(r))

const app = Z(
  async function hello (name, cb) {
    console.log('Say hello to ' + name)

    return await cb(
      'Hello ' + name + '!', 
      state => 'Good. You? ' + state
    )
  }
)

app.run(
  () => console.log('Foo is listening...')
)
