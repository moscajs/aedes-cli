const cli = require('../lib/cli')

const baseArgs = ['node', 'aedes']

function start (args) {
  if (args) {
    args.unshift(...baseArgs)
  } else {
    args = baseArgs
  }

  return cli(args)
}

function close (server) {
  return new Promise((resolve, reject) => {
    server.close(function (err) {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function stop (setup) {
  for (const server of setup.servers) {
    await close(server)
  }

  // broker.close() also closes the mq emitter
  await close(setup.broker)
}

module.exports = {
  start,
  stop
}
