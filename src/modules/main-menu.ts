import { Composer } from 'grammy';
import { MyContext } from '../main';
import { TgCallback, ik, tgCallbackMiddleware } from '../lib/utils';
import { checkConfigMenu } from './check-config';

export const mainMenuModule = new Composer<MyContext>();
const mainMenuPrivate = mainMenuModule.chatType(['private']);

function mainMenuMsg(ctx: MyContext) {
  return {
    text: ctx.t('welcome-message'),
    keyboard: [[checkConfigMenu.getBtn(ctx.t('config-btn'))]],
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

mainMenuModule
  .on('callback_query:data')
  .lazy(tgCallbackMiddleware([mainMenuCb].map((x) => x.setPrefix('menu'))));
