'use strict'

const hasher = require('./hasher')
var minimatch = require('minimatch')
var defaultGlob = '**'

const mapToObj = m => {
  return Array.from(m).reduce((obj, [key, value]) => {
    obj[key] = value
    return obj
  }, {})
}

// polyfill for Map
Object.entries = typeof Object.entries === 'function' ? Object.entries : obj => Object.keys(obj).map(k => [k, obj[k]])

/**
 * mosca.Authorizer's responsibility is to give an implementation
 * of mosca.Server callback of authorizations, against a JSON file.
 *
 * @param {Object} users The user hash, as created by this class
 *  (optional)
 * @api public
 */
function Authorizer (users) {
  this.users = users
}
module.exports = Authorizer

/**
 * It returns the authenticate function to plug into mosca.Server.
 *
 * @api public
 */
Authorizer.prototype.authenticate = function () {
  var that = this
  return function (client, user, pass, cb) {
    that._authenticate(client, user, pass, cb)
  }
}

/**
 * It returns the authorizePublish function to plug into mosca.Server.
 *
 * @api public
 */
Authorizer.prototype.authorizePublish = function () {
  var that = this
  return function (client, topic, payload, cb) {
    cb(null, minimatch(topic, that._users.get(client.user).authorizePublish || defaultGlob))
  }
}

/**
 * It returns the authorizeSubscribe function to plug into mosca.Server.
 *
 * @api public
 */
Authorizer.prototype.authorizeSubscribe = function () {
  var that = this
  return function (client, topic, cb) {
    cb(null, minimatch(topic, that._users.get(client.user).authorizeSubscribe || defaultGlob))
  }
}

/**
 * The real authentication function
 *
 * @api private
 */
Authorizer.prototype._authenticate = function (client, user, pass, cb) {
  var missingUser = !user || !pass || !this._users.get(user)

  if (missingUser) {
    cb(null, false)
    return
  }

  user = user.toString()

  client.user = user
  user = this._users.get(user)

  hasher.verifyPassword(user, pass.toString())
    .then(success => cb(null, success))
    .catch((err) => {
      cb(err)
    })
}

/**
 * An utility function to add an user.
 *
 * @api public
 * @param {String} user The username
 * @param {String} pass The password
 * @param {String} authorizePublish The authorizePublish pattern
 *   (optional)
 * @param {String} authorizeSubscribe The authorizeSubscribe pattern
 *   (optional)
 */
Authorizer.prototype.addUser = async function (user, pass, authorizePublish,
  authorizeSubscribe) {
  if (!authorizePublish) {
    authorizePublish = defaultGlob
  }

  if (!authorizeSubscribe) {
    authorizeSubscribe = defaultGlob
  }

  var { salt, hash } = await hasher.generateHashPassword(pass.toString())

  var exists = this._users.get(user)

  this._users.set(user, {
    salt: salt,
    hash: hash,
    authorizePublish: authorizePublish,
    authorizeSubscribe: authorizeSubscribe
  })

  return exists
}

/**
 * An utility function to delete a user.
 *
 * @api public
 * @param {String} user The username
 */
Authorizer.prototype.rmUser = function (user) {
  var exists = this._users.get(user)
  this._users.delete(user)

  return exists
}

/**
 * Users
 */
Object.defineProperty(Authorizer.prototype, 'users', {
  get: function () {
    return mapToObj(this._users)
  },
  set: function (users) {
    users = users || {}
    this._users = new Map(Object.entries(users))
  },
  enumerable: true
})
