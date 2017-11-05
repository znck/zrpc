const { Z } = require('../lib')

const app = Z({ host: 'localhost', port: 8081 })

app.hello('Rahul', any => any + ' How are you?').then(any => console.log(any)).catch(any => console.error(any))
