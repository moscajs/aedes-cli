const pino = require('pino')

const prettyOptions = {
  levelFirst: true, // shwo level
  ignore: 'pid,hostname,name', // params to ignore in the output
  translateTime: true // shwo time string instead of timestamp
}

module.exports = function initLogger (options) {
  return pino({
    name: options.name || 'aedes',
    level: options.level || 'warn',
    prettyPrint: options.pretty ? prettyOptions : false
  })
}
