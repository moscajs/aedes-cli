# aedes-cli

![CI](https://github.com/moscajs/aedes-cli/workflows/CI/badge.svg)
![Docker Build](https://github.com/moscajs/aedes-cli/workflows/Docker%20Build/badge.svg)
[![Total alerts](https://img.shields.io/lgtm/alerts/g/moscajs/aedes-cli.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/moscajs/aedes-cli/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/moscajs/aedes-cli.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/moscajs/aedes-cli/context:javascript)
[![NPM version](https://img.shields.io/npm/v/aedes-cli.svg?style=flat)](https://www.npmjs.com/aedes-cli)
[![NPM downloads](https://img.shields.io/npm/dm/aedes-cli.svg?style=flat)](https://www.npmjs.com/aedes-cli)
[![Known Vulnerabilities](https://snyk.io/test/github/moscajs/aedes-cli/badge.svg?targetFile=package.json)](https://snyk.io/test/github/moscajs/aedes-cli?targetFile=package.json)

[![opencollective](https://opencollective.com/aedes/donate/button.png)](https://opencollective.com/aedes/donate)

[Aedes](https://github.com/moscajs/aedes) MQTT broker CLI plugin

- [aedes-cli](#aedes-cli)
  - [Install](#install)
  - [Usage](#usage)
  - [Docker](#docker)
  - [Authorization](#authorization)
  - [Persistence and Emitters](#persistence-and-emitters)

## Install

Install the library using [npm](http://npmjs.org/).

```bash
npm install aedes-cli -g
```

## Usage

Here you can see the options accepted by the command line tool:

```text
$ aedes --help
______   ________  _______   ________   ______  
/      \ |        \|       \ |        \ /      \
|  $$$$$$\| $$$$$$$$| $$$$$$$\| $$$$$$$$|  $$$$$$\
| $$__| $$| $$__    | $$  | $$| $$__    | $$___\$$
| $$    $$| $$  \   | $$  | $$| $$  \    \$$    \
| $$$$$$$$| $$$$$   | $$  | $$| $$$$$    _\$$$$$$\
| $$  | $$| $$_____ | $$__/ $$| $$_____ |  \__| $$
| $$  | $$| $$     \| $$    $$| $$     \ \$$    $$
\$$   \$$ \$$$$$$$$ \$$$$$$$  \$$$$$$$$  \$$$$$$

Usage: aedes [options] [command]

Options:
  -V, --version                    output the version number
  -p, --port <n>                   the port to listen to
  --host <IP>                      the host to listen to
  --protos <protos>                comma separeted protocols. Allowed values are tcp, ws, wss, tls (default: ["tcp"])
  --credentials <file>             the file containing the credentials (default: "./credentials.json")
  --authorize-publish <pattern>    the pattern for publishing to topics for the added user
  --authorize-subscribe <pattern>  the pattern for subscribing to topics for the added user
  --concurrency <n>                broker maximum number of concurrent messages delivered by mqemitter
  --queueLimit <n>                 broker maximum number of queued messages before client session is established
  --maxClientsIdLength <n>         broker option to override MQTT 3.1.0 clients Id length limit
  --heartbeatInterval <n>          interval in millisconds at which broker beats its health signal in $SYS/<broker.id>/heartbeat
  --connectTimeout <n>             maximum waiting time in milliseconds waiting for a CONNECT packet.
  --key <file>                     the server's private key
  --cert <file>                    the certificate issued to the server
  --reject-unauthorized            reject clients using self signed certificates (default: true)
  --tls-port <n>                   the TLS port to listen to
  --ws-port <n>                    start an mqtt-over-websocket server on the specified port
  --wss-port <n>                   start an mqtt-over-secure-websocket server on the specified port
  --disable-stats                  disable the publishing of stats under $SYS (default: true)
  --broker-id <id>                 the id of the broker in the $SYS/<id> namespace
  -c, --config <c>                 the config file to use (override every other option)
  -v, --verbose                    set the log level to INFO
  --very-verbose                   set the log level to DEBUG
  --no-pretty                      JSON logs
  -h, --help                       display help for command

Commands:
  adduser <user> <pass>            Add a user to the given credentials file
  rmuser <user>                    Removes a user from the given credentials file
  start                            start the server (optional)
  help [command]                   display help for command
```

To fully use Aedes you need to define a configuration file where the communication
broker is defined. Here follows an example using Mongodb.

A configuration file is structured in the following way:

```js
module.exports = {
  protos: ['tcp'],
  host: '127.0.0.1',
  port: 1883,
  wsPort: 3000,
  wssPort: 4000,
  tlsPort: 8883,
  brokerId: 'aedes-cli',
  credentials: './credentials.json',
  persistence: {
    name: 'mongodb',
    options: {
      url: 'mongodb://127.0.0.1/aedes'
    }
  },
  mq: {
    name: 'mongodb',
    options: {
      url: 'mongodb://127.0.0.1/aedes'
    }
  },
  key: null,
  cert: null,
  rejectUnauthorized: true,
  verbose: false,
  veryVerbose: false,
  noPretty: false
}

```

## Docker

`aedes-cli` is available on [Docker-Hub](https://hub.docker.com/r/moscajs/aedes) for `amd64, arm64v8, arm32v6, arm32v7, i386` archs. If you want to use a local `credentials.json` file and/or a custom config file to pass using `--config` option you have to use docker volumes and map the local folder containing those files to a folder inside the container.

Example:

`docker run --rm -it -p 1883:1883 -v $(pwd):/data moscajs/aedes:latest --config /data/myConfig.js`

- `-v $(pwd):/data` will map the local folder from where you are running this command to `/data` folder of the container
- `--config /data/myConfig.js` will tell aedes to use the configuration file that is in your local folder

[Here](/docker/docker-compose.yml) there is an example with `docker-compose` that runs aedes with `mongodb` as persistence

 ```yml
 version: '3.7'
services:
  aedes:
    container_name: aedes
    image: moscajs/aedes:latest
    restart: always
    stop_signal: SIGINT
    networks:
      - mqtt
    command: --config /data/mongodbConfig.js # add here the options to pass to aedes
    volumes:
      - ./:/data # map the local folder to aedes
    ports:
      - '1883:1883'
      - '3000:3000'
      - '4000:4000'
      - '8883:8883'
  mongo:
    container_name: mongo
    networks:
      - mqtt
    logging:
      driver: none
    image: mvertes/alpine-mongo
    volumes:
      - db-data:/data/db
    ports:
      - "27017:27017"
volumes:
  db-data:
    name: db-data
networks:
  mqtt:
 ```

 When using persistences with docker-compose file remember that the database url will be the name of the service in docker-compose, in the mongo example it will be: `mongodb://mongo/dbName`.

## Authorization

Aedes supports user authentication through the use of a specific json file.
In order to create one run the following command.

```bash
// add a user
$ aedes adduser <user> <pass> --credentials ./credentials.json

// add a user specifying the authorized topics
$ aedes adduser myuser mypass --credentials ./credentials.json \
  --authorize-publish 'hello/*' --authorize-subscribe 'hello/*'

// remove a user
$ aedes rmuser myuser --credentials ./credentials.json

// start aedes with a specific set of credentials:
$ aedes --credentials ./credentials.json
```

The patterns are checked and validated using [Minimatch](https://github.com/isaacs/minimatch).
The credentials file is automatically reloaded by aedes when it receives a `SIGHUP`.

## Persistence and Emitters

The MQTT specification requires a persistent storage for offline QoS 1
subscription that has been done by an unclean client. Aedes offers several
persitance options.

Supported persistences are:

- [aedes-persistence]: In-memory implementation of an Aedes persistence
- [aedes-persistence-mongodb]: MongoDB persistence for Aedes
- [aedes-persistence-redis]: Redis persistence for Aedes

Emitters are needed to deliver messages to subscribed clients. In a cluster environment it is used also to share messages between brokers instances

All of them can be configured from the configuration file, under the `persistence` and `mq` key.

Supported mqemitters are:

- [mqemitter]: An opinionated memory Message Queue with an emitter-style API
- [mqemitter-redis]: Redis-powered mqemitter
- [mqemitter-mongodb]: Mongodb based mqemitter

[aedes-persistence]: https://www.npmjs.com/aedes-persistence
[aedes-persistence-mongodb]: https://www.npmjs.com/aedes-persistence-mongodb
[aedes-persistence-redis]: https://www.npmjs.com/aedes-persistence-redis

[mqemitter]: https://www.npmjs.com/mqemitter
[mqemitter-redis]: https://www.npmjs.com/mqemitter-redis
[mqemitter-mongodb]: https://www.npmjs.com/mqemitter-mongodb
