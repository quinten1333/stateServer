FROM node:current-alpine
LABEL org.opencontainers.image.source https://github.com/quinten1333/stateServer

ENV NODE_ENV production
ENV WS_PORT 80
ENV PORT 2000
EXPOSE 80 2000

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY ./src ./src/

CMD npm run start
