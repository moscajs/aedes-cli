'use strict'

var pkg = require('../package')
var commander = require('commander')
var path = require('path')
var Authorizer = require('./authorizer')
const { readFileSync, readFile, writeFile } = require('fs')
var steed = require('steed')()
var aedes = require('aedes')

const WebSocket = require('ws')
const tls = require('tls')
const http = require('http')
const https = require('https')
const net = require('net')

const PERSISTENCES = [
  'redis',
  'mongo',
  'memory'
]

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
 * @param {Function} cb The callback that will invoked with the authorizer
 */
function loadAuthorizer (program, cb) {
  if (program.credentials) {
    readFile(program.credentials, function (err, data) {
      if (err) {
        cb(err)
        return
      }

      var authorizer = new Authorizer()

      try {
        authorizer.users = JSON.parse(data)
        cb(null, authorizer)
      } catch (err) {
        cb(err)
      }
    })
  } else {
    cb(null, null)
  }
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
function createServer (protocol, options, handle, done) {
  var server = null
  if (protocol === 'tls') {
    server = tls.createServer(options, handle)
  } else if (protocol === 'ws' || protocol === 'wss') {
    server = protocol === 'ws' ? http.createServer() : https.createServer(options)
    startWebsocket(server, handle)
  } else if (protocol === 'tcp') {
    server = net.createServer(handle)
  } else {
    done(Error('Invalid protocol ' + protocol))
  }

  if (server) {
    server.listen(options.port, done)
  }
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
 * @param {Function} pre the callback to call before doing anything
 * @param {commander.Command} program the parsed argument
 * @param {Function} callback the callback to call when finished
 */
function start (program, callback) {
  return function () {
    var server = null

    var defopts = {
      concurrency: 100,
      queueLimit: 42,
      maxClientsIdLength: 23,
      heartbeatInterval: 60000,
      connectTimeout: 30000
    }

    var opts = defopts

    // opts.concurrency = program.concurrency
    // opts.queueLimit = program.queueLimit
    // opts.maxClientsIdLength = program.maxClientsIdLength
    // opts.heartbeatInterval = program.heartbeatInterval
    // opts.connectTimeout = program.connectTimeout

    server = aedes(opts)

    // if (program.disableStats) {
    //   opts.stats = false
    // }

    opts.id = program.brokerId

    var secureOpts = {}

    if (program.cert || program.key) {
      if (program.cert && program.key) {
        secureOpts.key = readFileSync(program.key)
        secureOpts.cert = readFileSync(program.cert)
        secureOpts.rejectUnauthorized = program.rejectUnauthorized
      } else {
        throw new Error('Must supply both private key and signed certificate to create secure aedes server')
      }
    }

    if (program.config) {
      opts = require(path.resolve(program.config))

      // merge any unspecified options into opts from defaults (defopts)
      Object.keys(defopts).forEach(function (key) {
        if (typeof opts[key] === 'undefined') {
          opts[key] = defopts[key]
        }
      })
    }

    // if (program.verbose) {
    //   opts.logger.level = 30
    // } else if (program.veryVerbose) {
    //   opts.logger.level = 20
    // }

    // if (program.db) {
    //   opts.persistence.path = program.db
    //   opts.persistence.factory = persistence.LevelUp
    // }

    var setupAuthorizer = function (cb) {
      process.on('SIGHUP', setupAuthorizer)
      server.on('closed', function () {
        process.removeListener('SIGHUP', setupAuthorizer)
      })

      loadAuthorizer(program, function (err, authorizer) {
        if (err) {
          callback(err)
          return
        }

        if (authorizer) {
          server.authenticate = authorizer.authenticate
          server.authorizeSubscribe = authorizer.authorizeSubscribe
          server.authorizePublish = authorizer.authorizePublish
        }

        if (cb) {
          cb(null, server)
        }
      })

      return false
    }

    var series = []

    for (const p of program.proto) {
      series.push(createServer.bind(this, p, secureOpts, server.handle))
    }

    series.push(setupAuthorizer)

    steed.series(series, function (err, results) {
      callback(err, results[1])
    })

    return server
  }
}

/**
 * The basic command line interface of Mosca.
 *
 * @api private
 */
module.exports = function cli (argv, callback) {
  argv = argv || []

  var program = new commander.Command()
  var runned = false

  callback = callback || function () {}

  program
    .version(pkg.version)
    .option('-p, --port <n>', 'the port to listen to', parseInt)
    .option('--host <IP>', 'the host to listen to')
    .option('-p, --proto <value>', 'protocol to use', null, ['mqtt'])
    .option('--credentials <file>', 'the file containing the credentials', null, './credentials.json')
    .option('--authorize-publish <pattern>', 'the pattern for publishing to topics for the added user')
    .option('--authorize-subscribe <pattern>', 'the pattern for subscribing to topics for the added user')
    .option('--key <file>', "the server's private key")
    .option('--cert <file>', 'the certificate issued to the server')
    .option('--reject-unauthorized', 'reject clients using self signed certificates', null, true)
    .option('--tls-port <n>', 'the TLS port to listen to', parseInt)
    .option('--ws-port <n>', 'start an mqtt-over-websocket server on the specified port', parseInt)
    .option('--wss-port <n>', 'start an mqtt-over-secure-websocket server on the specified port', parseInt)
    .option('--disable-stats', 'disable the publishing of stats under $SYS', null, true)
    .option('--broker-id <id>', 'the id of the broker in the $SYS/<id> namespace')
    .option('-c, --config <c>', 'the config file to use (override every other option)')
    .option('-v, --verbose', 'set the log level to INFO')
    .option('--very-verbose', 'set the log level to DEBUG')

  function loadAuthorizerAndSave (cb) {
    runned = true

    loadAuthorizer(program, function (err, authorizer) {
      if (err) {
        authorizer = new Authorizer()
      }

      cb(null, authorizer, function (err) {
        if (err) {
          callback(err)
          return
        }
        writeFile(program.credentials, JSON.stringify(authorizer.users, null, 2), callback)
      })
    })
  }

  function adduser (username, password) {
    runned = true
    loadAuthorizerAndSave(function (err, authorizer, done) {
      authorizer.addUser(username, password, program.authorizePublish,
        program.authorizeSubscribe, done)
    })
  }

  function rmuser (username) {
    runned = true
    loadAuthorizerAndSave(function (err, authorizer, done) {
      authorizer.rmUser(username, done)
    })
  }

  program
    .command('adduser <user> <pass>')
    .description('Add a user to the given credentials file')
    .action(adduser)

  program
    .command('rmuser <user>')
    .description('Removes a user from the given credentials file')
    .action(rmuser)

  var doStart = start(program, callback)

  program
    .command('start')
    .description('start the server (optional)')
    .action(doStart)

  program.parse(argv)

  if (!runned) {
    return doStart()
  }
}
