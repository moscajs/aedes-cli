const { test } = require('tap')
const { start, stop } = require('./helper')

const defaults = require('../config')

require('leaked-handles')

test('start without args', async function (t) {
  var setup = await start()

  t.tearDown(stop.bind(t, setup))

  t.equal(setup.servers.length, 1, 'should start one server')
  var info = setup.servers[0].address()
  t.equal(info.address, defaults.host, 'should have default host')
  t.equal(info.port, defaults.port, 'should have default port')
})
