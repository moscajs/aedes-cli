'use strict'

const neostandard = require('neostandard')

module.exports = [
  ...neostandard(),
  {
    ignores: ['node_modules/**']
  }
]
