const app = require('./index')


app.listen(process.env.port || 5000, null, null, () =>
  console.log('✔️ Running the website | port: ' + process.env.port)
)
