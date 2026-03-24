const { test } = require('node:test')
const assert = require('node:assert/strict')

const Authorizer = require('../lib/authorizer')

const { promisify } = require('util')

test('add user and authenticate/authorize', async function () {
  const authorizer = new Authorizer()

  const username = 'aedes'
  const password = 'rocks'
  const allowedGlob = 'allowed/topic/*'

  const client = {}

  await authorizer.addUser(username, password, allowedGlob, allowedGlob)

  assert.notEqual(authorizer.users[username], undefined, 'should add user')

  const authenticate = promisify(authorizer.authenticate())

  let res = await authenticate(client, 'pippo', 'pluto')

  assert.equal(res, false, 'should reject authentication')

  res = await authenticate(client, username, password)

  assert.equal(res, true, 'should successfully authenticate')

  const authorizePub = promisify(authorizer.authorizePublish())
  const authorizeSub = promisify(authorizer.authorizeSubscribe())

  const notAllowed = { topic: 'not/allowed' }
  const allowed = { topic: 'allowed/topic/1' }

  await assert.rejects(
    authorizePub(client, notAllowed),
    { message: 'Publish not authorized' }
  )

  await authorizePub(client, allowed)

  res = await authorizeSub(client, notAllowed)
  assert.equal(res, null, 'should not authorize sub on not allowed topics')

  res = await authorizeSub(client, allowed)
  assert.deepEqual(res, allowed, 'should authorize sub on allowed topics')

  authorizer.rmUser(username)

  assert.equal(authorizer.users[username], undefined, 'should remove user')
})
