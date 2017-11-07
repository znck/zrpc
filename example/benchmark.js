const { Z } = require('../lib')

process.on('unhandledRejection', r => console.log(r))

const app = Z(
  function hello (name) {
    return new Promise(resolve => setTimeout(() => resolve('Hello ' + name), 100 + Math.random() * 400))
  }
)

app.run(
  () => console.log('Foo is listening...')
)
