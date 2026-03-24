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

// wait for mqemitter-mongodb in-flight bulkWrite to complete
// workaround for https://github.com/mcollina/mqemitter-mongodb/pull/65
function waitForMqDrain (mq) {
  return new Promise((resolve) => {
    function check () {
      if (mq._executingBulk) {
        setTimeout(check, 10)
      } else {
        resolve()
      }
    }
    check()
  })
}

async function stop (setup) {
  for (const server of setup.servers) {
    await close(server)
  }

  if (setup.mq && setup.mq._executingBulk !== undefined) {
    await waitForMqDrain(setup.mq)
  }

  // broker.close() also closes the mq emitter
  await close(setup.broker)

  if (setup.persistence && typeof setup.persistence.destroy === 'function') {
    try {
      await setup.persistence.destroy()
    } catch {
      // ignore errors during persistence teardown
    }
  }
}

module.exports = {
  start,
  stop
}
