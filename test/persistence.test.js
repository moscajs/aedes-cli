const { test } = require('tap')
const { start, stop } = require('./helper')

const { join } = require('path')

const PERSISTENCE = process.env.DB || 'mongodb'

test(`test ${PERSISTENCE} persistence from config`, async function (t) {
  var persistenceConfig = join(__dirname, `config/${PERSISTENCE}Config.js`)

  var setup = await start(['--config', persistenceConfig])

  await stop(setup)

  t.end()
})
