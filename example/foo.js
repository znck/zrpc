const Z = require('../lib').default

process.on('unhandledRejection', r => console.log(r))

const app = Z(
  function hello (name, cb) {
    console.log('Say hello to ' + name)

    return cb(`Hello ${name}!`)
  }
)

app.listen(8000)
