module.exports = {
  protos: ['tcp'],
  host: '127.0.0.1',
  port: 1883,
  wsPort: 3000,
  wssPort: 4000,
  tlsPort: 8883,
  brokerId: 'aedes-cli',
  credentials: './credentials.json',
  persistence: {
    name: 'mongodb',
    options: {
      url: 'mongodb://127.0.0.1/aedes'
    }
  },
  //   mq: {
  //     name: 'mongodb',
  //     options: {
  //       url: 'mongodb://127.0.0.1/aedes'
  //     }
  //   },
  //   persistence: {
  //     name: 'redis',
  //     options: {}
  //   },
  //   mq: {
  //     name: 'redis',
  //     options: {}
  //   }
  key: null,
  cert: null,
  rejectUnauthorized: true,
  verbose: false,
  veryVerbose: false,
  noPretty: false
}
