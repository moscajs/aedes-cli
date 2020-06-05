'use-strict'

const { once } = require('events')

const PERSISTENCES = {
  redis: {
    waitForReady: true
  },
  mongodb: {
    waitForReady: true
  }
}

module.exports = async function initPersistence (config) {
  var persistence
  var mq

  // start persistence
  if (config.persistence) {
    const name = config.persistence.name
    if (!PERSISTENCES[name]) {
      throw Error('persistence ' + name + ' isn\'t supported')
    } else {
      persistence = require('aedes-persistence-' + name)(config.persistence.options || {})
    //   if (PERSISTENCES[name].waitForReady) {
    //     await once(persistence, 'ready')
    //   }
    }
  } else {
    persistence = require('aedes-persistence')()
  }

  if (config.mq) {
    const name = config.mq.name
    if (!PERSISTENCES[name]) {
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
