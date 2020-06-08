const { test } = require('tap')
const { start, stop } = require('./helper')
const { readFile, unlink } = require('fs').promises

const defaults = require('../config')

const { join } = require('path')

const credentialsFile = join(__dirname, '/credentials.json')

require('leaked-handles')

test('start without args', async function (t) {
  t.plan(7)
  var setup = await start()

  t.tearDown(stop.bind(t, setup))

  t.equal(setup.servers.length, 1, 'should start one server')
  var info = setup.servers[0].address()
  t.equal(info.address, defaults.host, 'should have default host')
  t.equal(info.port, defaults.port, 'should have default port')

  var broker = setup.broker
  t.equal(broker.id, defaults.brokerId, 'should have default brokerId')
  t.equal(broker.queueLimit, defaults.queueLimit, 'should have default queueLimit')
  t.equal(broker.maxClientsIdLength, defaults.maxClientsIdLength, 'should have default maxClientsIdLength')
  t.equal(broker.connectTimeout, defaults.connectTimeout, 'should have default connectTimeout')
})

test('start multiple servers', async function (t) {
  t.plan(9)

  var servers = {
    tcp: defaults.port,
    ws: defaults.wsPort,
    tls: defaults.tlsPort,
    wss: defaults.wssPort
  }
  var args = ['--protos', Object.keys(servers).join(','), '--cert', join(__dirname, '/secure/server.cert'), '--key', join(__dirname, '/secure/server.key')]

  var setup = await start(args)

  t.tearDown(stop.bind(t, setup))

  t.equal(setup.servers.length, 4, 'should start 4 server')

  for (const server of setup.servers) {
    var info = server.address()
    t.equal(info.address, defaults.host, 'should have default host')
    t.equal(info.port, servers[server._protocol], 'should have default port')
  }
})

test('should add/remove user from credentials', async function (t) {
  t.plan(2)

  var username = 'aedes'
  var password = 'rocks'

  var args = ['--credentials', credentialsFile, 'adduser', username, password]

  await start(args)

  var data = JSON.parse(await readFile(credentialsFile))

  var user = data[username]

  t.equal(!!user, true, 'user has been successfully created')

  args = ['--credentials', credentialsFile, 'rmuser', username]

  await start(args)

  data = JSON.parse(await readFile(credentialsFile))

  user = data[username]

  t.equal(user, undefined, 'user has been successfully removed')

  await unlink(credentialsFile)
})
