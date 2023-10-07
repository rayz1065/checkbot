# CheckBot, a private Telegram bot to manage checklists

This bot can manage checklists in:

- groups, through the #check hashtag and /check command
- channels, by editing on the fly posts with #check in them
- the private chat with the bot, by responding to any message containing checkboxes
- any chat using inline mode

It even works in groups with protected content OR (exclusive) anonymous admins in groups.
It does _not_ work for anonymous admins in groups with protected content.

## How it works

Instead of storing the checklist in the database, every time a checklist is edited by pressing a box, the message of the checklist is forwarded to the user's chat such that the bot can read it.
Before allowing the user to update a checklist a series of verifications are done, controlling the authenticity of the request through a hash stored in the URL and the permissions through the Telegram bot API.

There are a couple of workarounds to make all of the settings indicated above work, like using the private chat of the user to store a checklist in a group with protected content.

## Setup and run

You will need a bot API token, get one by contacting [BotFather](https://t.me/botfather), after that create a .env file by copying the .env.example, be sure to change the `CHECKBOX_HMAC_SECRET` with a random string, `POSTGRES_PASSWORD` with a secure password, and `BOT_TOKEN` with the token you received from BotFather.

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
docker compose exec app npx prisma db push
```

## License

[GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html).
