const { test } = require('tap')
const { start, stop } = require('./helper')

const { join } = require('path')

const PERSISTENCE = process.env.DB || 'mongodb'

console.log(`Testing ${PERSISTENCE} persistence`)

test(`test ${PERSISTENCE} persistence from config`, async function (t) {
  const persistenceConfig = join(__dirname, `config/${PERSISTENCE}Config.js`)

  const setup = await start(['--config', persistenceConfig])

  await stop(setup)

  t.end()
})
