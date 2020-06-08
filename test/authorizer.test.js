const { test } = require('tap')

const Authorizer = require('../lib/authorizer')

const promisifyMulti = function (fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn(...args, function (...res) {
        if (res[0]) reject(res[0])
        else {
          res.shift()
          resolve(res)
        }
      })
    })
  }
}

test('add user and authenticate/authorize', async function (t) {
  t.plan(7)
  var authorizer = new Authorizer()

  var username = 'aedes'
  var password = 'rocks'
  var allowed = 'allowed/topic/*'

  var client = {}

  await authorizer.addUser(username, password, allowed, allowed)

  t.notEqual(authorizer.users[username], undefined, 'should add user')

  var authenticate = promisifyMulti(authorizer.authenticate())

  var res = await authenticate(client, username, password)

  t.equal(res[0], true, 'should successfully authenticate')

  var authorizePub = promisifyMulti(authorizer.authorizePublish())
  var authorizeSub = promisifyMulti(authorizer.authorizeSubscribe())

  res = await authorizePub(client, 'not/allowed', null)
  t.equal(res[0], false, 'should not authorize pub on not allowed topics')

  res = await authorizePub(client, 'allowed/topic/1', null)
  t.equal(res[0], true, 'should authorize pub on allowed topics')

  res = await authorizeSub(client, 'not/allowed')
  t.equal(res[0], false, 'should not authorize sub on not allowed topics')

  res = await authorizeSub(client, 'allowed/topic/1')
  t.equal(res[0], true, 'should authorize sub on allowed topics')

  authorizer.rmUser(username)

  t.equal(authorizer.users[username], undefined, 'should remove user')
})
