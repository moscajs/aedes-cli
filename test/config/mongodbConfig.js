module.exports = {
  // SERVERS
  protos: ['tcp'],
  host: '127.0.0.1',
  port: 1883,
  wsPort: 3000,
  wssPort: 4000,
  tlsPort: 8883,
  key: null,
  cert: null,
  rejectUnauthorized: true,
  // AUTHORIZER
  credentials: null,
  // AEDES
  brokerId: 'aedes-cli',
  concurrency: 100,
  queueLimit: 42,
  maxClientsIdLength: 23,
  heartbeatInterval: 60000,
  connectTimeout: 30000,
  disableStats: true,
  // PERSISTENCES
  persistence: {
    name: 'mongodb',
    options: {
      url: 'mongodb://127.0.0.1/aedes'
    }
  },
  mq: {
    name: 'mongodb',
    options: {
      url: 'mongodb://127.0.0.1/aedes'
    }
  },
  // LOGGER
  verbose: false,
  veryVerbose: false,
  noPretty: false
}
