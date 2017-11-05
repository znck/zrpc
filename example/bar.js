const Z = require('../lib').default
process.on('unhandledRejection', r => console.log(r))

const app = Z({ host: '127.0.0.1', port: 8000 })

;(async () => {
  try {
    console.log(
      await app.request('hello', ['Rahul', any => any + ' How are you?'])
    )
  } catch (e) {
    console.error('ERROR', e)
  }
})()

