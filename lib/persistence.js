'use strict'

const { once } = require('events')

const SUPPORTED = ['redis', 'mongodb']

module.exports = async function initPersistence (config) {
  let persistence
  let mq

  // start persistence
  if (config.persistence) {
    const name = config.persistence.name
    if (!SUPPORTED.includes(name)) {
      throw Error('persistence ' + name + ' isn\'t supported')
    } else {
      persistence = require('aedes-persistence-' + name)(config.persistence.options || {})
    }
  } else {
    persistence = require('aedes-persistence')()
  }

  if (config.mq) {
    const name = config.mq.name
    if (!SUPPORTED.includes(name)) {
      throw Error('mqemitter ' + name + ' isn\'t supported')
    } else {
      mq = require('mqemitter-' + name)(config.mq.options || {})
      if (name === 'mongodb') {
        await once(mq.status, 'stream')
      }
    }
  } else {
    mq = require('mqemitter')()
  }

  return { mq, persistence }
}
