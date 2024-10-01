# CheckBot, a private Telegram bot to manage checklists

This bot can manage checklists in:

- groups, through the #check hashtag and /check command
- channels, by editing on the fly posts with #check in them
- the private chat with the bot, by responding to any message containing checkboxes
- any chat using inline mode

It even works in groups with protected content OR (exclusive) anonymous admins in groups.
It does _not_ work for anonymous admins in groups with protected content.

## How it works

The checklist is not stored in the database, instead, every time a checklist is edited, the bot forwards the message containing it to the user's chat in order to read it.
Before allowing the user to update a checklist a series of verification steps is performed, controlling the authenticity of the request through a hash stored in the URL and the permissions through the Telegram bot API.

There are a couple of workarounds to make all of the settings indicated above work, like using the private chat of the user to store a checklist in a group with protected content.

## Infrastructure

The bot and web app are made to run inside [docker](https://www.docker.com/), both during development and deployment.
The `src` directory contains the code for the bot server:

- The bot itself, written using the [GrammyJs](https://grammy.dev/) framework
- The api, required by the webapp to interface with the bot's logic, written using the [ExpressJs](https://expressjs.com/) framework

The `web` directory contains the webapp, which can be used to more quickly edit checklists in any chat. It is built in [Remix](https://remix.run/), a web framework based on react.
It uses [Mantine](https://mantine.dev/) as the components library.

The database, which is used to store basic user data such as the configs, uses [postgres](https://www.postgresql.org/) and is managed through [prisma](https://www.prisma.io/).

A suggested method for deployment is present in `docker-compose.prod.yml`, which shows how [traefik](https://traefik.io/) can be used as a reverse proxy for the various services.

## Setup and run

You will need a bot API token, get one by contacting [BotFather](https://t.me/botfather), after that create a .env file by copying the .env.example, be sure to change the `CHECKBOX_HMAC_SECRET` with a random string, `POSTGRES_PASSWORD` with a secure password, and `BOT_TOKEN` with the token you received from BotFather.
In order to run the web app, you will need to set the `WEB_APP_URL` to the website where the web app is hosted, and `WEB_APP_API_URL` to the url where the express server with the api is hosted.

Copy or link the configuration you want to use to `docker-compose.override.yml`.
To use the bot in development mode write:

```sh
ln --symbolic --force docker-compose.dev.yml docker-compose.override.yml
```

You may also want to run `yarn install` to download the dependencies on your machine, which are essential for your code editor to give you hints.

To use it in production mode write:

```sh
ln --symbolic --force docker-compose.prod.yml docker-compose.override.yml
```

Start the services by running:

```sh
docker compose up
```

You will need to do a one-time setup of the bot, to get the exact list of steps run:

```sh
docker compose exec app npx ts-node src/bin/setup-bot.ts
```

You can use that utility script to update most configurations automatically for you, the rest will need to be changed through BotFather.

Finally you will need to run the database migrations:

```sh
docker compose exec app npx prisma migrate deploy
```

## Translating

Translating is done in the [fluent](https://projectfluent.org/) language, create or edit a file under `src/i18n`, the language will be immediately available to users who have set it in the Telegram client.
If you want to add it to the available configurations edit `src/modules/check-config.ts` and add it to `botLanguages`.

## License

[GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html).
