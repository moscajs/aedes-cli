const { test } = require('tap')
const { start, stop } = require('./helper')
const { readFile, unlink } = require('fs').promises

const { promisify } = require('util')

const defaults = require('../config')

const { join } = require('path')

const credentialsFile = join(__dirname, '/credentials.json')
const certFile = join(__dirname, '/secure/server.cert')
const keyFile = join(__dirname, '/secure/server.key')

require('leaked-handles')

test('start without args', async function (t) {
  t.plan(7)
  const setup = await start()

  t.teardown(stop.bind(t, setup))

  t.equal(setup.servers.length, 1, 'should start one server')
  const info = setup.servers[0].address()
  t.equal(info.address, defaults.host, 'should have default host')
  t.equal(info.port, defaults.port, 'should have default port')

  const broker = setup.broker
  t.equal(broker.id, defaults.brokerId, 'should have default brokerId')
  t.equal(broker.queueLimit, defaults.queueLimit, 'should have default queueLimit')
  t.equal(broker.maxClientsIdLength, defaults.maxClientsIdLength, 'should have default maxClientsIdLength')
  t.equal(broker.connectTimeout, defaults.connectTimeout, 'should have default connectTimeout')
})

test('start multiple servers', async function (t) {
  t.plan(9)

  const servers = {
    tcp: defaults.port,
    ws: defaults.wsPort,
    tls: defaults.tlsPort,
    wss: defaults.wssPort
  }
  const args = ['--protos', ...Object.keys(servers), '--cert', certFile, '--key', keyFile]

  const setup = await start(args)

  t.teardown(stop.bind(t, setup))

  t.equal(setup.servers.length, 4, 'should start 4 server')

  for (const server of setup.servers) {
    const info = server.address()
    t.equal(info.address, defaults.host, 'should have default host')
    t.equal(info.port, servers[server._protocol], 'should have default port')
  }
})

test('throws error when invalid command', async function (t) {
  t.plan(1)

  const command = 'invalid'

  try {
    await start([command])
  } catch (error) {
    t.equal(error.message, 'Unknown command ' + command, 'throws error')
  }
})

test('do not setup authorizer if credentials is not found', async function (t) {
  t.plan(1)

  const setup = await start(['--credentials', credentialsFile])

  t.teardown(stop.bind(t, setup))

  const broker = setup.broker
  const success = await promisify(broker.authenticate)()
  t.equal(success, true, 'should authorize everyone')
})

test('add/remove user and load authorizer', async function (t) {
  t.plan(3)

  const username = 'aedes'
  const password = 'rocks'

  let args = ['--credentials', credentialsFile, 'adduser', username, password]

  await start(args)

  let data = JSON.parse(await readFile(credentialsFile))

  let user = data[username]

  t.equal(!!user, true, 'user has been successfully created')

  args = ['--credentials', credentialsFile]

  const setup = await start(args)

  const success = await promisify(setup.broker.authenticate)({}, username, password)

  t.equal(success, true, 'should load authorizer and authenticate the user')

  await stop(setup)

  args = ['--credentials', credentialsFile, 'rmuser', username]

  await start(args)

  data = JSON.parse(await readFile(credentialsFile))

  user = data[username]

  t.equal(user, undefined, 'user has been successfully removed')

  await unlink(credentialsFile)
})

test('add/remove user from credentials throws error', async function (t) {
  t.plan(2)

  const username = 'aedes'
  const password = 'rocks'

  let args = ['adduser', username, password]

  try {
    await start(args)
  } catch (error) {
    console.log(error.message)
    t.equal(error.message, 'you must specify a valid credential file using --credentials option', 'adduser throws error')
  }

  args = ['rmuser', username]

  try {
    await start(args)
  } catch (error) {
    t.equal(error.message, 'you must specify a valid credential file using --credentials option', 'rmuser throws error')
  }
})

test('key/cert errors', async function (t) {
  t.plan(4)

  let args = ['--protos', 'tls']

  try {
    await start(args)
  } catch (error) {
    t.equal(error.message, 'Must supply both private key and signed certificate to create secure aedes server', 'throws error when protocol is secure and key|cert is missing')
  }

  args = ['--protos', 'tls', '--key', keyFile]

  try {
    await start(args)
  } catch (error) {
    t.equal(error.message, 'Must supply both private key and signed certificate to create secure aedes server', 'throws error when cert is missing')
  }

  args = ['--protos', 'tls', '--cert', certFile]

  try {
    await start(args)
  } catch (error) {
    t.equal(error.message, 'Must supply both private key and signed certificate to create secure aedes server', 'throws error when key is missing')
  }

  args = ['--protos', 'tls', '--cert', 'not/exists', '--key', 'not/exists']

  try {
    await start(args)
  } catch (error) {
    t.equal(error.message, 'ENOENT: no such file or directory, open \'not/exists\'', 'throws error when key/cert file are missing')
  }
})
