FROM node:12.18.0-alpine

LABEL maintainer="robertsLando"

WORKDIR /usr/src/app/

COPY . .

RUN npm install

EXPOSE 1883 3000 8883 4000

ENTRYPOINT [ "/usr/src/app/bin/aedes" ]
