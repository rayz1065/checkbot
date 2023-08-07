import { Composer } from 'grammy';
import { MyContext } from '../main';
import { TgCallback, ik, tgCallbackMiddleware } from '../lib/utils';
import { checkConfigMenu } from './check-config';

export const mainMenuModule = new Composer<MyContext>();
const mainMenuPrivate = mainMenuModule.chatType(['private']);

function mainMenuMsg(ctx: MyContext) {
  return {
    text: ctx.t('welcome-message'),
    keyboard: [
      [checkConfigMenu.getBtn(ctx.t('config-btn'))],
      [helpCb.getBtn(ctx.t('help-btn'))],
    ],
  };
}

mainMenuPrivate.command('start', async (ctx) => {
  const { text, keyboard } = mainMenuMsg(ctx);
  await ctx.reply(text, ik(keyboard));
});

export const mainMenuCb = new TgCallback('menu', async (ctx) => {
  const { text, keyboard } = mainMenuMsg(ctx);
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery('👋');
});

function helpMsg(ctx: MyContext) {
  return {
    text:
      `<b>${ctx.t('help-btn')}</b>\n` +
      `${ctx.t('need-help-with-the-bot')}\n` +
      `${ctx.t('contact-me')}`,
    keyboard: [[mainMenuCb.getBtn(ctx.t('back-to-menu'))]],
  };
}

export const helpCb = new TgCallback('help', async (ctx) => {
  const { text, keyboard } = helpMsg(ctx);
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(ctx.t('help-btn'));
});

mainMenuPrivate.command('help', async (ctx) => {
  const { text, keyboard } = helpMsg(ctx);
  await ctx.reply(text, ik(keyboard));
});

mainMenuModule
  .on('callback_query:data')
  .lazy(
    tgCallbackMiddleware([mainMenuCb, helpCb].map((x) => x.setPrefix('menu')))
  );
