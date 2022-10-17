const { test } = require('tap')

const Authorizer = require('../lib/authorizer')

const { promisify } = require('util')

test('add user and authenticate/authorize', async function (t) {
  t.plan(8)
  const authorizer = new Authorizer()

  const username = 'aedes'
  const password = 'rocks'
  const allowedGlob = 'allowed/topic/*'

  const client = {}

  await authorizer.addUser(username, password, allowedGlob, allowedGlob)

  t.not(authorizer.users[username], undefined, 'should add user')

  const authenticate = promisify(authorizer.authenticate())

  let res = await authenticate(client, 'pippo', 'pluto')

  t.equal(res, false, 'should reject authentication')

  res = await authenticate(client, username, password)

  t.equal(res, true, 'should successfully authenticate')

  const authorizePub = promisify(authorizer.authorizePublish())
  const authorizeSub = promisify(authorizer.authorizeSubscribe())

  const notAllowed = { topic: 'not/allowed' }
  const allowed = { topic: 'allowed/topic/1' }

  try {
    res = await authorizePub(client, notAllowed)
  } catch (error) {
    t.equal(error.message, 'Publish not authorized', 'should not authorize pub on not allowed topics')
  }

  await authorizePub(client, allowed)
  t.pass('should authorize pub on allowed topics')

  res = await authorizeSub(client, notAllowed)
  t.equal(res, null, 'should not authorize sub on not allowed topics')

  res = await authorizeSub(client, allowed)
  t.deepEqual(res, allowed, 'should authorize sub on allowed topics')

  authorizer.rmUser(username)

  t.equal(authorizer.users[username], undefined, 'should remove user')
})
