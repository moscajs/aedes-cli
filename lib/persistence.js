
const PERSISTENCES = {
  redis: {
    waitForReady: true
  },
  mongodb: {
    waitForReady: true
  }
}

module.exports = function initPersistence (config, cb) {
  var persistence
  var mq

  var done = 0

  function onDone () {
    if (++done === 2) {
      cb(persistence, mq)
    }
  }

  // start persistence
  if (config.persistence) {
    const name = config.persistence.name
    if (!PERSISTENCES[name]) {
      throw Error('persistence ' + name + ' isn\'t supported')
    } else {
      persistence = require('aedes-persistence-' + name)(config.persistence.options || {})
      if (PERSISTENCES[name].waitForReady) {
        persistence.once('ready', onDone)
      } else {
        onDone()
      }
    }
  } else {
    persistence = require('aedes-persistence')()
    onDone()
  }

  if (config.mq) {
    const name = config.mq.name
    if (!PERSISTENCES[name]) {
      throw Error('mqemitter ' + name + ' isn\'t supported')
    } else {
      mq = require('mqemitter-' + name)(config.mq.options || {})
      if (name === 'mongodb') {
        mq.status.once('stream', onDone)
      } else {
        onDone()
      }
    }
  } else {
    mq = require('mqemitter')()
    onDone()
  }
}
