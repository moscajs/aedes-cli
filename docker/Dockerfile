FROM node:20-alpine

LABEL maintainer="robertsLando"

WORKDIR /usr/src/app/

COPY . .

# set production env, npm install will not install devDependencies
ENV NODE_ENV=production

# if node_modules does not exist, run it, otherwise skip
RUN test -d node_modules || npm install --omit=dev

RUN chmod 755 /usr/src/app/bin/aedes

EXPOSE 1883 3000 8883 4000

# used to detect if we are running in docker
ENV IS_DOCKER=true

ENTRYPOINT [ "/usr/src/app/bin/aedes" ]
