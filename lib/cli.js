'use strict'

const pkg = require('../package')
const { program } = require('commander')
const path = require('path')
const Authorizer = require('./authorizer')
const { readFile, writeFile } = require('fs').promises
const aedes = require('aedes')
const initPersistences = require('./persistence')
const initLogger = require('./logger')
const configDefaults = require('../config')
const { once } = require('events')

const WebSocket = require('ws')
const tls = require('tls')
const http = require('http')
const https = require('https')
const net = require('net')

const PROTOS = [
  'tcp',
  'ws',
  'tls',
  'wss'
]

/**
 * Load a new Authorizer
 *
 * @api private
 * @param {commander.Command} program the specified options from the command line
 */
async function loadAuthorizer (program) {
  var authorizer = null
  if (program.credentials) {
    var data
    try {
      data = await readFile(program.credentials)
    } catch (error) {
      console.log('%s error while reading file: %s', program.credentials, error.message)
      data = '{}'
    }

    authorizer = new Authorizer()

    authorizer.users = JSON.parse(data)
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
      server.listen(port, host, (err) => {
        if (err) reject(err)
        else resolve(server)

        console.log('%s server listening on port %s:%d', protocol.toUpperCase(), host, port)
      })
    }
  })
}

function startWebsocket (server, handle) {
  const ws = new WebSocket.Server({ server })
  ws.on('connection', function (conn, req) {
    const stream = WebSocket.createWebSocketStream(conn)
    handle(stream, req)
  })
}

/**
 * Start a new server
 *
 * @api private
 * @param {commander.Command} program the parsed argument
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
  var { persistence, mq } = initPersistences(config)

  var aedesDefaults = {
    concurrency: 100,
    queueLimit: 42,
    maxClientsIdLength: 23,
    heartbeatInterval: 60000,
    connectTimeout: 30000,
    persistence: persistence,
    mq: mq
  }

  var aedesOpts = aedesDefaults

  // opts.concurrency = config.concurrency
  // opts.queueLimit = config.queueLimit
  // opts.maxClientsIdLength = config.maxClientsIdLength
  // opts.heartbeatInterval = config.heartbeatInterval
  // opts.connectTimeout = config.connectTimeout
  aedesOpts.id = config.brokerId

  var broker = aedes(aedesOpts)

  if (broker.persistence.waitForReady) {
    await once(broker.persistence, 'ready')
  }

  broker.on('subscribe', function (subscriptions, client) {
    logger.info('MQTT client \x1b[32m%s\x1b[0m subscribed to: %s from broker %s', client ? client.id : client, subscriptions.map(s => s.topic).join('\n'), broker.id)
  })

  broker.on('unsubscribe', function (subscriptions, client) {
    logger.info('MQTT client \x1b[32m%s\x1b[0m unsubscribed to: %s from broker %s', client ? client.id : client, subscriptions.map(s => s.topic).join('\n'), broker.id)
  })

  // fired when a client connects
  broker.on('client', function (client) {
    logger.info('Client Connected: \x1b[33m%s\x1b[0m to broker %s', (client ? client.id : client), broker.id)
  })

  // fired when a client disconnects
  broker.on('clientDisconnect', function (client) {
    logger.info('Client Disconnected: \x1b[33m%s\x1b[0m to broker %s', (client ? client.id : client), broker.id)
  })

  // fired when a message is published
  broker.on('publish', async function (packet, client) {
    logger.info('Client \x1b[31m%s\x1b[0m has published %s on %s to broker %s', (client ? client.id : 'BROKER_' + broker.id), packet.payload.toString(), packet.topic, broker.id)
  })

  // broker authorizer
  var setupAuthorizer = async function () {
    process.on('SIGHUP', setupAuthorizer)
    broker.on('closed', function () {
      process.removeListener('SIGHUP', setupAuthorizer)
    })

    var authorizer = await loadAuthorizer(program)

    if (authorizer) {
      broker.authenticate = authorizer.authenticate
      broker.authorizeSubscribe = authorizer.authorizeSubscribe
      broker.authorizePublish = authorizer.authorizePublish
    }

    return authorizer
  }

  await setupAuthorizer()

  // STATS ------------

  // if (config.disableStats) {
  //   //disable stats
  // }

  // SERVERS ------------

  var ports = {
    tcp: config.port,
    ws: config.wsPort,
    tls: config.tlsPort,
    wss: config.wssPort
  }

  var serverOpts = {}

  if (config.cert || config.key) {
    if (config.cert && config.key) {
      serverOpts.key = await readFile(config.key)
      serverOpts.cert = await readFile(config.cert)
      serverOpts.rejectUnauthorized = config.rejectUnauthorized
    } else {
      throw new Error('Must supply both private key and signed certificate to create secure aedes server')
    }
  }

  var servers = []

  for (const p of config.protos) {
    servers.push(await createServer(p, config.host, ports[p], serverOpts, broker.handle))
  }

  return { servers, broker, logger }
}

/**
 * The basic command line interface of Mosca.
 *
 * @api private
 */
module.exports = function cli (argv) {
  return new Promise((resolve, reject) => {
    argv = argv || []

    function commaSeparatedList (value) {
      return value.split(',').map(v => v.trim())
    }

    program
      .version(pkg.version)
      .option('-p, --port <n>', 'the port to listen to', parseInt)
      .option('--host <IP>', 'the host to listen to')
      .option('--protos <protos>', 'comma separeted protocols. Allowed values are tcp, ws, wss, tls', commaSeparatedList, ['tcp'])
      .option('--credentials <file>', 'the file containing the credentials', './credentials.json')
      .option('--authorize-publish <pattern>', 'the pattern for publishing to topics for the added user')
      .option('--authorize-subscribe <pattern>', 'the pattern for subscribing to topics for the added user')
      .option('--key <file>', "the server's private key")
      .option('--cert <file>', 'the certificate issued to the server')
      .option('--reject-unauthorized', 'reject clients using self signed certificates', true)
      .option('--tls-port <n>', 'the TLS port to listen to', parseInt)
      .option('--ws-port <n>', 'start an mqtt-over-websocket server on the specified port', parseInt)
      .option('--wss-port <n>', 'start an mqtt-over-secure-websocket server on the specified port', parseInt)
    //  .option('--disable-stats', 'disable the publishing of stats under $SYS', true)
      .option('--broker-id <id>', 'the id of the broker in the $SYS/<id> namespace')
      .option('-c, --config <c>', 'the config file to use (override every other option)')
      .option('-v, --verbose', 'set the log level to INFO')
      .option('--very-verbose', 'set the log level to DEBUG')
      .option('--no-pretty', 'JSON logs')

    async function saveAuthorizer (authorizer) {
      return writeFile(program.credentials, JSON.stringify(authorizer.users, null, 2))
    }

    async function adduser (username, password) {
      try {
        var authorizer = await loadAuthorizer(program)
        if (!authorizer) {
          throw Error('credentials file ' + program.credentials + ' not found')
        }
        var exists = await authorizer.addUser(username, password, program.authorizePublish, program.authorizeSubscribe)
        await saveAuthorizer(authorizer)
        console.log('User %s successfully %s', username, exists ? 'MODIFIED' : 'CREATED')
        resolve()
      } catch (error) {
        reject(error)
      }
    }

    async function rmuser (username) {
      try {
        var authorizer = await loadAuthorizer(program)
        if (!authorizer) {
          throw Error('credentials file ' + program.credentials + ' not found')
        }
        var exists = authorizer.rmUser(username)
        await saveAuthorizer(authorizer)
        console.log('User %s %s', username, exists ? 'successfully REMOVED' : 'doesn\'t exists')
        resolve()
      } catch (error) {
        reject(error)
      }
    }

    function doStart () {
      return start(program)
        .then(resolve)
        .catch(reject)
    }

    program
      .command('adduser <user> <pass>')
      .description('Add a user to the given credentials file')
      .action(adduser)

    program
      .command('rmuser <user>')
      .description('Removes a user from the given credentials file')
      .action(rmuser)

    program
      .command('start', { isDefault: true })
      .description('start the server (optional)')
      .action(doStart)

    program.parse(argv)
  })
}
