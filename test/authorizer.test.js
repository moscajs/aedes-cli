const { test } = require('tap')

const Authorizer = require('../lib/authorizer')

const { promisify } = require('util')

test('add user and authenticate/authorize', async function (t) {
  t.plan(8)
  var authorizer = new Authorizer()

  var username = 'aedes'
  var password = 'rocks'
  var allowed = 'allowed/topic/*'

  var client = {}

  await authorizer.addUser(username, password, allowed, allowed)

  t.notEqual(authorizer.users[username], undefined, 'should add user')

  var authenticate = promisify(authorizer.authenticate())

  var res = await authenticate(client, 'pippo', 'pluto')

  t.equal(res, false, 'should reject authentication')

  res = await authenticate(client, username, password)

  t.equal(res, true, 'should successfully authenticate')

  var authorizePub = promisify(authorizer.authorizePublish())
  var authorizeSub = promisify(authorizer.authorizeSubscribe())

  res = await authorizePub(client, { topic: 'not/allowed' }, null)
  t.equal(res, false, 'should not authorize pub on not allowed topics')

  res = await authorizePub(client, { topic: 'allowed/topic/1' }, null)
  t.equal(res, true, 'should authorize pub on allowed topics')

  res = await authorizeSub(client, { topic: 'not/allowed' })
  t.equal(res, false, 'should not authorize sub on not allowed topics')

  res = await authorizeSub(client, { topic: 'allowed/topic/1' })
  t.equal(res, true, 'should authorize sub on allowed topics')

  authorizer.rmUser(username)

  t.equal(authorizer.users[username], undefined, 'should remove user')
})
