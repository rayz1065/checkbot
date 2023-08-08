/**
 * Utility script to perform the bot setup, run with --help for usage
 */
import * as dotenv from 'dotenv';
import { program } from 'commander';
import { bot, i18n } from '../main';

dotenv.config();
if (!process.env.BOT_TOKEN) {
  throw new Error('Bot token not found');
}

const defaultLocale = process.env.DEFAULT_LOCALE ?? 'en';

program
  .option('--name', 'Update the name of the bot')
  .option('--commands', 'Update the bot commands')
  .option('--description', 'Update the description of the bot')
  .option('--short_description', 'Update the short description of the bot')
  .option('--rights', 'Updates the requested rights in channels and groups')
  .option('--all', 'Update everything')
  .addHelpText('beforeAll', 'This utility script can help you setup your bot')
  .addHelpText('afterAll', furtherSetup());

program.parse();

const options: {
  name?: true;
  commands?: true;
  description?: true;
  short_description?: true;
  rights?: true;
  all?: true;
} = program.opts();

function getLanguageCode(locale: string) {
  return locale === defaultLocale ? undefined : locale;
}

function prettyPrintLocale(locale: string) {
  return locale === defaultLocale ? 'default' : locale;
}

async function setMyName() {
  for (const locale of i18n.locales) {
    await bot.api.setMyName(i18n.translate(locale, 'bot-name'), {
      language_code: getLanguageCode(locale),
    });
    console.log('Updated name for locale', prettyPrintLocale(locale));
  }
}

async function setMyCommands() {
  for (const locale of i18n.locales) {
    await bot.api.setMyCommands(
      [
        {
          command: 'help',
          description: i18n.t(locale, 'help-command-tip'),
        },
        {
          command: 'config',
          description: i18n.t(locale, 'config-command-tip'),
        },
        {
          command: 'check',
          description: i18n.t(locale, 'check-command-tip'),
        },
      ],
      { language_code: getLanguageCode(locale) }
    );
    console.log('Updated commands for locale', prettyPrintLocale(locale));
  }
}

async function setMyDescription() {
  for (const locale of i18n.locales) {
    await bot.api.setMyDescription(i18n.t(locale, 'bot-description'), {
      language_code: getLanguageCode(locale),
    });
    console.log('Updated description for locale', prettyPrintLocale(locale));
  }
}

async function setMyShortDescription() {
  for (const locale of i18n.locales) {
    await bot.api.setMyShortDescription(
      i18n.t(locale, 'bot-short-description'),
      { language_code: getLanguageCode(locale) }
    );
    console.log(
      'Updated short description for locale',
      prettyPrintLocale(locale)
    );
  }
}

async function setMyDefaultAdministratorRights() {
  await bot.api.setMyDefaultAdministratorRights({
    for_channels: true,
    rights: {
      can_edit_messages: true,
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_manage_chat: false,
      can_manage_video_chats: false,
      can_promote_members: false,
      can_restrict_members: false,
      is_anonymous: false,
    },
  });

  await bot.api.setMyDefaultAdministratorRights({
    for_channels: false,
    rights: {
      can_change_info: false,
      can_delete_messages: false,
      can_invite_users: false,
      can_manage_chat: false,
      can_manage_video_chats: false,
      can_promote_members: false,
      can_restrict_members: false,
      is_anonymous: false,
      can_edit_messages: true,
      can_post_messages: true,
    },
  });

  console.log('Updated default administrator rights');
}

function furtherSetup() {
  const nextSteps = [
    'Update the bot picture',
    'Toggle inline mode on',
    'Edit the inline placeholder',
    'Turn inline feedback to 100%',
  ];

  return (
    "To complete the setup, if you haven't already done it:\n" +
    nextSteps.map((x) => `- ${x}`).join('\n')
  );
}

async function main() {
  if (options.all) {
    options.name = true;
    options.commands = true;
    options.description = true;
    options.short_description = true;
    options.rights = true;
  }

  if (
    !options.name &&
    !options.commands &&
    !options.description &&
    !options.short_description &&
    !options.rights
  ) {
    program.outputHelp();
    process.exit();
  }

  if (options.name) {
    await setMyName();
  }
  if (options.commands) {
    await setMyCommands();
  }
  if (options.description) {
    await setMyDescription();
  }
  if (options.short_description) {
    await setMyShortDescription();
  }
  if (options.rights) {
    await setMyDefaultAdministratorRights();
  }

  console.log(furtherSetup());
}

void main();
