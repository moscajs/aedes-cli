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
  await close(setup.broker)

  setup.broker.persistence.destroy()

  for (const server of setup.servers) {
    await close(server)
  }
}

module.exports = {
  start,
  stop
}
