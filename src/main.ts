import * as dotenv from 'dotenv';
import { Bot, Context, session, SessionFlavor } from 'grammy';
import { sequentialize } from 'grammy-middlewares';
import { hydrateReply, parseMode, ParseModeFlavor } from '@grammyjs/parse-mode';
import {
  Conversation,
  ConversationFlavor,
  conversations,
} from '@grammyjs/conversations';
import { escapeHtml, findTgCallback, ik } from './lib/utils';
import { calendarCallbacks } from './lib/calendar';
import { PrismaClient, User, UserConfig } from '@prisma/client';
import { authenticate } from './middlewares/authenticate';
import { I18n, I18nFlavor } from '@grammyjs/i18n';
import { emoji } from 'node-emoji';
import path from 'path';
import { PrismaAdapter } from '@grammyjs/storage-prisma';
import { checkListChannelModule, checkListModule } from './modules/checklist';
import { checkConfigModule } from './modules/check-config';
import { mainMenuModule } from './modules/main-menu';

dotenv.config();
if (!process.env.BOT_TOKEN) {
  throw new Error('Bot token not found');
} else if (!process.env.CHECKBOX_HMAC_SECRET) {
  throw new Error('CHECKBOX_HMAC_SECRET is not set');
}

// session, context, conversation types
export type MySessionData = {
  _empty?: null;
};
export type MyContext = ParseModeFlavor<
  SessionFlavor<MySessionData> & ConversationFlavor<Context> & I18nFlavor
> & {
  callbackParams: any;
  dbUser: User & { config: UserConfig | null };
  conversationData?: {
    messageId?: number;
  } & Record<string, any>;
};
export type MyConversation = Conversation<MyContext>;

// set up translations
export const i18n = new I18n<MyContext>({
  defaultLocale: process.env.DEFAULT_LOCALE ?? 'en',
  directory: path.join(__dirname, 'i18n'),
  localeNegotiator: (ctx) =>
    ctx.dbUser?.language ?? ctx.from?.language_code ?? 'en',
  globalTranslationContext(ctx) {
    return {
      'emoji-cancel': emoji.x,
      'emoji-back': emoji.back,
      'emoji-confirm': emoji.white_check_mark,
      'user-name': escapeHtml(ctx.from?.first_name ?? ''),
      'bot-name': ctx.me.username,
    };
  },
});

// set up db connection and base bot configuration
export const prisma = new PrismaClient();
export const bot = new Bot<MyContext>(process.env.BOT_TOKEN);
bot.use(sequentialize());
bot.use(hydrateReply);
bot.api.config.use(parseMode('HTML'));
bot.use(
  session({
    initial: () => ({}),
    storage: new PrismaAdapter(prisma.session),
  })
);

bot.errorBoundary((err) => {
  console.error(err);
});

bot.use(i18n);

// before authentication...
bot.use(checkListChannelModule);

bot.use(authenticate);

// share bot
bot.on('inline_query').filter(
  (ctx) => ctx.inlineQuery.query === '',
  async (ctx) => {
    await ctx.answerInlineQuery(
      [
        {
          id: 'share',
          type: 'article',
          title: `${ctx.t('share')} ${ctx.me.first_name}`,
          description: `${ctx.t('join-bot')} ${emoji.white_check_mark}`,
          input_message_content: {
            message_text: ctx.t('join-bot'),
            parse_mode: 'HTML',
          },
          ...ik([
            [
              {
                text: `${ctx.t('enter-bot')} ${emoji.white_check_mark}`,
                url: `https://t.me/${ctx.me.username}?start=ref_${ctx.dbUser.id}`,
              },
            ],
          ]),
        },
      ],
      { cache_time: 0 }
    );
  }
);

// set up conversations
bot.use(conversations());

async function hasPendingConversation(ctx: MyContext) {
  const activeConversations = await ctx.conversation.active();
  return Object.keys(activeConversations).length !== 0;
}

bot.command('cancel', async (ctx) => {
  if (!(await hasPendingConversation(ctx))) {
    return await ctx.reply(ctx.t('no-pending-operation'));
  }
  await ctx.conversation.exit();
  await ctx.reply(ctx.t('operation-cancelled'));
});

// prevent unrelated messages in conversations
// bot.on('message').filter(hasPendingConversation, async (ctx) => {
//   await ctx.reply(ctx.t('write-cancel-to-cancel-operation'));
// });

// modules
bot.use(checkListModule);
bot.use(checkConfigModule);
bot.use(mainMenuModule);

// listen for callbacks
bot.on('callback_query:data').lazy((ctx) => {
  const cbData = ctx.callbackQuery.data;
  const { match, values } = findTgCallback([...calendarCallbacks], cbData);
  if (match) {
    ctx.callbackParams = values;
    return match.middleware;
  }
  console.warn('No match for data', cbData);
  return [];
});

bot.on('callback_query:data', async (ctx) => {
  await ctx.answerCallbackQuery('I did not understand the request');
});

bot.catch((error) => {
  if (error.message.indexOf('message is not modified:') !== -1) {
    return;
  }
  console.error(error);
});
