'use strict'

const crypto = require('crypto')
const PASSWORD_LENGTH = 256
const SALT_LENGTH = 64
const ITERATIONS = 10000
const DIGEST = 'sha256'
const BYTE_TO_STRING_ENCODING = 'hex' // this could be base64, for instance

/**
 * Generates a PersistedPassword given the password provided by the user. This should be called when creating a user
 * or redefining the password
 */
module.exports.generateHashPassword = function (password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString(BYTE_TO_STRING_ENCODING)
    crypto.pbkdf2(password, salt, ITERATIONS, PASSWORD_LENGTH, DIGEST, (error, hash) => {
      if (error) {
        reject(error)
      } else {
        resolve({ salt: salt, hash: hash.toString(BYTE_TO_STRING_ENCODING) })
      }
    })
  })
}

/**
 * Verifies the attempted password against the password information saved in the database. This should be called when
 * the user tries to log in.
 */
module.exports.verifyPassword = function (persistedPassword, passwordAttempt) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(passwordAttempt, persistedPassword.salt, ITERATIONS, PASSWORD_LENGTH, DIGEST, (error, hash) => {
      if (error) {
        reject(error)
      } else {
        resolve(persistedPassword.hash === hash.toString(BYTE_TO_STRING_ENCODING))
      }
    })
  })
}
