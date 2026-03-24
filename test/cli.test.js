const { test } = require('node:test')
const assert = require('node:assert/strict')
const { start, stop } = require('./helper')
const { readFile, unlink, rm } = require('fs').promises

const { promisify } = require('util')

const defaults = require('../config')
const path = require('path')

const credentialsFile = path.resolve(__dirname, '../credentials.json')
const certFile = path.resolve(__dirname, './secure/server.cert')
const keyFile = path.resolve(__dirname, './secure/server.key')

require('leaked-handles')

test('start without args', async function (t) {
  const setup = await start(['--port', '18830'])

  t.after(async () => stop(setup))

  assert.equal(setup.servers.length, 1, 'should start one server')
  const info = setup.servers[0].address()
  assert.equal(info.port, 18830, 'should have correct port')

  const broker = setup.broker
  assert.equal(broker.id, defaults.brokerId, 'should have default brokerId')
  assert.equal(broker.queueLimit, defaults.queueLimit, 'should have default queueLimit')
  assert.equal(broker.maxClientsIdLength, defaults.maxClientsIdLength, 'should have default maxClientsIdLength')
  assert.equal(broker.connectTimeout, defaults.connectTimeout, 'should have default connectTimeout')
})

test('start multiple servers', async function (t) {
  const ports = {
    tcp: 18831,
    ws: 18832,
    tls: 18833,
    wss: 18834
  }
  const args = [
    '--port', String(ports.tcp),
    '--ws-port', String(ports.ws),
    '--tls-port', String(ports.tls),
    '--wss-port', String(ports.wss),
    '--protos', ...Object.keys(ports),
    '--cert', certFile,
    '--key', keyFile
  ]

  const setup = await start(args)

  t.after(async () => stop(setup))

  assert.equal(setup.servers.length, 4, 'should start 4 server')

  for (const server of setup.servers) {
    const info = server.address()
    assert.equal(info.port, ports[server._protocol], 'should have correct port')
  }
})

test('throws error when invalid command', async function () {
  const command = 'invalid'

  await assert.rejects(
    start([command]),
    { message: 'Unknown command ' + command }
  )
})

test('do not setup authorizer if credentials is not found', async function (t) {
  await rm(credentialsFile, { force: true })
  const setup = await start(['--port', '18835', '--credentials', credentialsFile])

  t.after(async () => stop(setup))

  const broker = setup.broker
  const success = await promisify(broker.authenticate)(null, null, null)
  assert.equal(success, true, 'should authorize everyone')
})

test('add/remove user and load authorizer', async function () {
  const username = 'aedes'
  const password = 'rocks'

  let args = ['--credentials', credentialsFile, 'adduser', username, password]

  await start(args)

  let data = JSON.parse(await readFile(credentialsFile))

  let user = data[username]

  assert.equal(!!user, true, 'user has been successfully created')

  args = ['--port', '18836', '--credentials', credentialsFile]

  const setup = await start(args)

  const success = await promisify(setup.broker.authenticate)({}, username, password)

  assert.equal(success, true, 'should load authorizer and authenticate the user')

  await stop(setup)

  args = ['--credentials', credentialsFile, 'rmuser', username]

  await start(args)

  data = JSON.parse(await readFile(credentialsFile))

  user = data[username]

  assert.equal(user, undefined, 'user has been successfully removed')

  await unlink(credentialsFile)
})

test('add/remove user from credentials throws error', async function () {
  const username = 'aedes'
  const password = 'rocks'

  let args = ['adduser', username, password]

  await assert.rejects(
    start(args),
    { message: 'you must specify a valid credential file using --credentials option' }
  )

  args = ['rmuser', username]

  await assert.rejects(
    start(args),
    { message: 'you must specify a valid credential file using --credentials option' }
  )
})

test('key/cert errors', async function () {
  let args = ['--protos', 'tls']

  await assert.rejects(
    start(args),
    { message: 'Must supply both private key and signed certificate to create secure aedes server' }
  )

  args = ['--protos', 'tls', '--key', keyFile]

  await assert.rejects(
    start(args),
    { message: 'Must supply both private key and signed certificate to create secure aedes server' }
  )

  args = ['--protos', 'tls', '--cert', certFile]

  await assert.rejects(
    start(args),
    { message: 'Must supply both private key and signed certificate to create secure aedes server' }
  )

  args = ['--protos', 'tls', '--cert', 'not/exists', '--key', 'not/exists']

  await assert.rejects(
    start(args),
    { message: "ENOENT: no such file or directory, open 'not/exists'" }
  )
})
