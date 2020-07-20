const { test } = require('tap')

const Authorizer = require('../lib/authorizer')

const { promisify } = require('util')

test('add user and authenticate/authorize', async function (t) {
  t.plan(8)
  var authorizer = new Authorizer()

  var username = 'aedes'
  var password = 'rocks'
  var allowedGlob = 'allowed/topic/*'

  var client = {}

  await authorizer.addUser(username, password, allowedGlob, allowedGlob)

  t.notEqual(authorizer.users[username], undefined, 'should add user')

  var authenticate = promisify(authorizer.authenticate())

  var res = await authenticate(client, 'pippo', 'pluto')

  t.equal(res, false, 'should reject authentication')

  res = await authenticate(client, username, password)

  t.equal(res, true, 'should successfully authenticate')

  var authorizePub = promisify(authorizer.authorizePublish())
  var authorizeSub = promisify(authorizer.authorizeSubscribe())

  var notAllowed = { topic: 'not/allowed' }
  var allowed = { topic: 'allowed/topic/1' }

  res = await authorizePub(client, notAllowed)
  t.equal(res, false, 'should not authorize pub on not allowed topics')

  res = await authorizePub(client, allowed)
  t.equal(res, true, 'should authorize pub on allowed topics')

  res = await authorizeSub(client, notAllowed)
  t.equal(res, null, 'should not authorize sub on not allowed topics')

  res = await authorizeSub(client, allowed)
  t.deepEqual(res, allowed, 'should authorize sub on allowed topics')

  authorizer.rmUser(username)

  t.equal(authorizer.users[username], undefined, 'should remove user')
})
