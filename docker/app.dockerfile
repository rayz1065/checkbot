FROM node:20

WORKDIR /usr/src/app

COPY package.json package.json
COPY yarn.lock yarn.lock

RUN yarn install && yarn cache clean

COPY .env .env
COPY prisma prisma

RUN npx prisma generate

COPY . .
