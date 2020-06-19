'use strict'

const pkg = require('../package')
const yargs = require('yargs')
const path = require('path')
const Authorizer = require('./authorizer')
const { readFile, writeFile } = require('fs').promises
const aedes = require('aedes')
const initPersistences = require('./persistence')
const initLogger = require('./logger')
const configDefaults = require('../config')
const { once } = require('events')
const stats = require('aedes-stats')

const WebSocket = require('ws')
const tls = require('tls')
const http = require('http')
const https = require('https')
const net = require('net')

// SETUP YARGS
yargs
  .version(pkg.version)
  .alias('V', 'version')
  .usage('Usage: aedes [command] [options]')
  .option('port', {
    alias: 'p',
    description: 'the port to listent to',
    type: 'number',
    default: 1883
  })
  .option('host', {
    description: 'the host to listen to',
    type: 'string',
    default: '127.0.0.1'
  })
  .option('protos', {
    description: 'protocols to use',
    type: 'array',
    choices: ['tcp', 'tls', 'ws', 'wss'],
    default: ['tcp']
  })
  .option('credentials', {
    description: '<file> the file containing the credentials',
    type: 'string'
  })
  .option('authorize-publish', {
    description: '<pattern> the pattern for publishing to topics for the added user',
    type: 'string'
  })
  .option('authorize-subscribe', {
    description: '<pattern> the pattern for subscribing to topics for the added user',
    type: 'string'
  })
  .option('concurrency', {
    description: 'broker maximum number of concurrent messages delivered by mqemitter',
    default: 100,
    type: 'number'
  })
  .option('queueLimit', {
    description: 'broker maximum number of queued messages before client session is established',
    default: 42,
    type: 'number'
  })
  .option('maxClientsIdLength', {
    description: 'broker option to override MQTT 3.1.0 clients Id length limit',
    default: 23,
    type: 'number'
  })
  .option('heartbeatInterval', {
    description: 'interval in millisconds at which broker beats its health signal in $SYS/<broker.id>/heartbeat',
    default: 60000,
    type: 'number'
  })
  .option('connectTimeout', {
    description: 'maximum waiting time in milliseconds waiting for a CONNECT packet',
    default: 30000,
    type: 'number'
  })
  .option('key', {
    description: '<file> the server\'s private key',
    type: 'string'
  })
  .option('cert', {
    description: '<file> the certificate issued to the server',
    type: 'string'
  })
  .option('reject-unauthorized', {
    description: 'reject clients using self signed certificates',
    type: 'boolean',
    default: true
  })
  .option('tls-port', {
    description: 'the TLS port to listen to',
    default: 8883,
    type: 'number'
  })
  .option('ws-port', {
    description: 'mqtt-over-websocket server port',
    default: 3000,
    type: 'number'
  })
  .option('wss-port', {
    description: 'mqtt-over-secure-websocket server port',
    default: 4000,
    type: 'number'
  })
  .option('disable-stats', {
    description: 'disable the publishing of stats under $SYS',
    type: 'boolean',
    default: true
  })
  .option('stats-interval', {
    description: 'interval between aedes stats pubs',
    default: 5000,
    type: 'number'
  })
  .option('broker-id', {
    description: 'the id of the broker in the $SYS/<id> namespace',
    default: 'aedes-cli',
    type: 'string'
  })
  .option('config', {
    alias: 'c',
    description: '<file> the config file to use (overrides every other option)',
    type: 'string'
  })
  .option('verbose', {
    alias: 'v',
    description: 'set the log level to INFO',
    type: 'boolean',
    default: false
  })
  .option('very-verbose', {
    description: 'set the log level to DEBUG',
    type: 'boolean',
    default: false
  })
  .option('no-pretty', {
    description: 'JSON logs',
    type: 'boolean',
    default: false
  })
  .command({
    command: 'adduser <user> <password>',
    describe: 'Add a user to given credentials file'
  })
  .command({
    command: 'rmuser <user>',
    describe: 'Removes a user from given credentials file'
  })
  .command({
    command: ['start', '$0'],
    describe: 'Starts Aedes broker with given options'
  })
  .example('aedes --protos tcp ws', 'Starts Aedes broker with TCP and WS servers')
  .example('aedes --config myConfig.js', 'Starts Aedes broker with custom config file')
  .example('aedes --no-disable-stats -v --statsInterval 2000', 'Starts Aedes broker with stats enabled')
  .example('aedes --credentials ./credentials.json adduser user1 password1', 'Add/Modify user1 with password1 to credentials')
  .example('aedes --credentials ./credentials.json rmuser user1', 'Removes user1 from credentials')
  .help()
  .alias('h', 'help')

/**
 * Load a new Authorizer
 *
 * @api private
 * @param {Object} program yargs parsed args
 */
async function loadAuthorizer (program, create) {
  var authorizer = null
  if (program.credentials) {
    var data
    try {
      data = await readFile(program.credentials)
      data = JSON.parse(data)
    } catch (error) {
      console.log('unable to load credentials file: %s', program.credentials, error.message)
      if (create) {
        console.log('creating NEW credentials file %s', program.credentials)
        data = {}
      } else {
        return null
      }
    }

    authorizer = new Authorizer()

    authorizer.users = data
  }

  return authorizer
}

/**
 * Servers factory
 *
 * @api private
 * @param {String} protocol the protocol
 * @param {Object} options options for secure protocols
 * @param {Aedes.handle} handle Aedes handle
 * @param {Function} done callback
 */
async function createServer (protocol, host, port, options, handle) {
  return new Promise((resolve, reject) => {
    var server = null
    if (protocol === 'tls') {
      server = tls.createServer(options, handle)
    } else if (protocol === 'ws' || protocol === 'wss') {
      server = protocol === 'ws' ? http.createServer() : https.createServer(options)
      startWebsocket(server, handle)
    } else if (protocol === 'tcp') {
      server = net.createServer(handle)
    } else {
      reject(Error('Invalid protocol ' + protocol))
    }

    if (server) {
      server._protocol = protocol
      server.listen(port, host, (err) => {
        if (err) reject(err)
        else resolve(server)

        console.log('%s server listening on port %s:%d', protocol.toUpperCase(), host, port)
      })
    }
  })
}

/**
 * Allows broker to handle websockets connections
 *
 * @param {http.Server|https.Server} server Http/Https server
 * @param {Aedes.handle} handle Broker handle function
 */
function startWebsocket (server, handle) {
  const ws = new WebSocket.Server({ server })
  ws.on('connection', function (conn, req) {
    handle(WebSocket.createWebSocketStream(conn), req)
  })
}

/**
 * Start a new server
 *
 * @api private
 * @param {Object} program yargs parsed args
 */
async function start (program) {
  // PARSE CONFIG ------------
  var config = {}

  // get configs from file
  if (program.config) {
    config = require(path.resolve(program.config))
  } else {
    // add cli configs
    for (const k in configDefaults) {
      if (program[k] !== undefined) {
        config[k] = program[k]
      }
    }
  }

  // merge any unspecified options into opts from defaults (defopts)
  for (const k in configDefaults) {
    if (config[k] === undefined) {
      config[k] = configDefaults[k]
    }
  }

  var ports = {
    tcp: config.port,
    ws: config.wsPort,
    tls: config.tlsPort,
    wss: config.wssPort
  }

  var serverOpts = {}

  const isSecure = config.protos.indexOf('tls') >= 0 || config.protos.indexOf('wss') >= 0

  if (isSecure) {
    if (config.cert && config.key) {
      serverOpts.key = await readFile(config.key)
      serverOpts.cert = await readFile(config.cert)
      serverOpts.rejectUnauthorized = config.rejectUnauthorized
    } else {
      throw new Error('Must supply both private key and signed certificate to create secure aedes server')
    }
  }

  // LOGGER ------------

  var loggerOpts = {}

  if (config.verbose) {
    loggerOpts.level = 30
  } else if (config.veryVerbose) {
    loggerOpts.level = 20
  }

  loggerOpts.pretty = !config.noPretty

  var logger = initLogger(loggerOpts)

  // BROKER ------------
  var { persistence, mq } = await initPersistences(config)

  var aedesOpts = {
    persistence: persistence,
    mq: mq
  }

  aedesOpts.concurrency = config.concurrency
  aedesOpts.queueLimit = config.queueLimit
  aedesOpts.maxClientsIdLength = config.maxClientsIdLength
  aedesOpts.heartbeatInterval = config.heartbeatInterval
  aedesOpts.connectTimeout = config.connectTimeout
  aedesOpts.id = config.brokerId

  var broker = aedes(aedesOpts)

  if (broker.persistence.waitForReady) {
    await once(broker.persistence, 'ready')
  }

  broker.on('subscribe', function (subscriptions, client) {
    logger.info('Client \x1b[32m%s\x1b[0m SUBSCRIBED to: %s, broker %s', client ? client.id : client, subscriptions.map(s => s.topic).join('\n'), broker.id)
  })

  broker.on('unsubscribe', function (subscriptions, client) {
    logger.info('Client \x1b[32m%s\x1b[0m UNSUBSCRIBED to: %s, broker %s', client ? client.id : client, subscriptions.map(s => s.topic).join('\n'), broker.id)
  })

  // fired when a client connects
  broker.on('client', function (client) {
    logger.info('Client \x1b[33m%s\x1b[0m CONNECTED, broker %s', (client ? client.id : client), broker.id)
  })

  // emitted when the client has received all its offline messages and be initialized
  broker.on('clientReady', function (client) {
    logger.info('Client \x1b[33m%s\x1b[0m READY, broker %s', (client ? client.id : client), broker.id)
  })

  // emitted when an error occurs
  broker.on('clientError', function (client, error) {
    logger.error('Client \x1b[33m%s\x1b[0m ERROR: %s, broker %s', (client ? client.id : client), error.message, broker.id)
  })

  // like clientError but raises only when client is uninitialized
  broker.on('connectionError', function (client, error) {
    logger.error('Client \x1b[33m%s\x1b[0m ERROR: %s, broker %s', (client ? client.id : client), error.message, broker.id)
  })

  // fired when timeout happes in the client keepalive.
  broker.on('keepaliveTimeout', function (client) {
    logger.error('Client \x1b[33m%s\x1b[0m KEEPALIVE timeout, broker %s', (client ? client.id : client), broker.id)
  })

  // QoS 1 or 2 acknowledgement when the packet successfully delivered to the client
  broker.on('ack', function (packet, client) {
    logger.debug('ACK of %s received from client \x1b[33m%s\x1b[0m, broker %s', packet.topic, (client ? client.id : client), broker.id)
  })

  // when client sends a PINGREQ
  broker.on('ping', function (packet, client) {
    logger.debug('PINGREQ received from client \x1b[33m%s\x1b[0m, broker %s', (client ? client.id : client), broker.id)
  })

  // when server sends a CONNACK to client
  broker.on('connackSent', function (packet, client) {
    logger.debug('CONNACK sent to \x1b[33m%s\x1b[0m, broker %s', (client ? client.id : client), broker.id)
  })

  // fired when a client disconnects
  broker.on('clientDisconnect', function (client) {
    logger.info('Client \x1b[33m%s\x1b[0m DISCONNECTED, broker %s', (client ? client.id : client), broker.id)
  })

  // fired when a message is published
  broker.on('publish', function (packet, client) {
    logger.info('Client \x1b[31m%s\x1b[0m PUBLISH %s on %s, broker %s', (client ? client.id : 'BROKER_' + broker.id), packet.payload.toString(), packet.topic, broker.id)
  })

  // broker authorizer
  var setupAuthorizer = async function () {
    process.on('SIGHUP', setupAuthorizer)
    broker.on('closed', function () {
      process.removeListener('SIGHUP', setupAuthorizer)
    })

    var authorizer = await loadAuthorizer(program)

    if (authorizer) {
      broker.authenticate = authorizer.authenticate()
      broker.authorizeSubscribe = authorizer.authorizeSubscribe()
      broker.authorizePublish = authorizer.authorizePublish()
    }

    return authorizer
  }

  await setupAuthorizer()

  // STATS ------------

  if (!config.disableStats) {
    stats(broker, { interval: program.statsInterval })
  }

  // SERVERS ------------

  var servers = []

  for (const p of config.protos) {
    servers.push(await createServer(p, config.host, ports[p], serverOpts, broker.handle))
  }

  return { servers, broker, logger }
}

/**
 * Store authorizer users to credentials file
 *
 * @param {Authorizer} authorizer The authorizer instance
 * @param {Object} program yargs parsed args
 * @returns A promise that resolves once write has finished
 */
function saveAuthorizer (authorizer, program) {
  return writeFile(program.credentials, JSON.stringify(authorizer.users, null, 2))
}

/**
 * Add user to the credentials file
 *
 * @param {Object} program yargs parsed args
 * @returns An object with `username` and `exists`
 */
async function adduser (program) {
  var username = program.user
  var password = program.password

  var authorizer = await loadAuthorizer(program, true)
  if (!authorizer) {
    throw Error('you must specify a valid credential file using --credentials option')
  }
  var exists = await authorizer.addUser(username, password, program.authorizePublish, program.authorizeSubscribe)
  await saveAuthorizer(authorizer, program)
  console.log('User %s successfully %s', username, exists ? 'MODIFIED' : 'CREATED')
  return { username, exists }
}

/**
 * Remove user from the credentials file
 *
 * @param {Object} program yargs parsed args
 * @returns An object with `username` and `exists`
 */
async function rmuser (program) {
  var username = program.user
  var authorizer = await loadAuthorizer(program)
  if (!authorizer) {
    throw Error('you must specify a valid credential file using --credentials option')
  }
  var exists = authorizer.rmUser(username)
  await saveAuthorizer(authorizer, program)
  console.log('User %s %s', username, exists ? 'successfully REMOVED' : 'doesn\'t exists')
  return { username, exists }
}

/**
 * The basic command line interface of Aedes.
 *
 * @api private
 */
module.exports = async function cli (cliArgs) {
  var program = yargs.parse(cliArgs.slice(2))

  var command = program._.shift() || 'start'

  switch (command) {
    case 'start':
      command = start(program)
      break
    case 'adduser':
      command = adduser(program)
      break
    case 'rmuser':
      command = rmuser(program)
      break
    default:
      throw Error('Unknown command ' + command)
  }

  return command
}
