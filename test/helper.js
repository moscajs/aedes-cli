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

  await close(setup.broker)

  if (setup.persistence && typeof setup.persistence.destroy === 'function') {
    await setup.persistence.destroy()
  }

  if (setup.mq && typeof setup.mq.close === 'function') {
    await new Promise((resolve) => setup.mq.close(resolve))
  }
}

module.exports = {
  start,
  stop
}
