FROM node:erbium-alpine

LABEL maintainer="robertsLando"

WORKDIR /usr/src/app/

COPY . .

RUN npm install
RUN chmod 755 /usr/src/app/bin/aedes

EXPOSE 1883 3000 8883 4000

ENTRYPOINT [ "/usr/src/app/bin/aedes" ]
