import { Composer } from 'grammy';
import { MyContext, prisma } from '../main';
import {
  TgCallback,
  ik,
  selectedBtnText,
  tgCallbackMiddleware,
} from '../lib/utils';
import { UserConfig } from '@prisma/client';
import { mainMenuCb } from './main-menu';
import {
  suggestedCheckedBoxes,
  suggestedUncheckedBoxes,
} from '../services/checklist-extractor';

export const checkConfigModule = new Composer<MyContext>();

export const botLanguages = [
  { code: 'IT', flag: '🇮🇹' },
  { code: 'EN', flag: '🇬🇧' },
];

export function getEmptyConfig(): Omit<Omit<UserConfig, 'user_id'>, 'id'> {
  return {
    default_checked_box: suggestedCheckedBoxes[0],
    default_unchecked_box: suggestedUncheckedBoxes[0],
    show_edit_confirmation: true,
  };
}

function checkConfigMsg(ctx: MyContext) {
  const config = ctx.dbUser.config ?? getEmptyConfig();

  const keyboard = [
    suggestedCheckedBoxes.map((box, idx) =>
      pickDefaultCheckedBox.getBtn(
        selectedBtnText(box, box === config.default_checked_box),
        idx
      )
    ),
    suggestedUncheckedBoxes.map((box, idx) =>
      pickDefaultUncheckedBox.getBtn(
        selectedBtnText(box, box === config.default_unchecked_box),
        idx
      )
    ),
    botLanguages.map((language) =>
      pickLanguage.getBtn(
        selectedBtnText(language.flag, language.code === ctx.dbUser.language),
        language.code
      )
    ),
  ];
  if (ctx.from && ctx.from?.id === ctx.chat?.id) {
    if (!config.show_edit_confirmation) {
      keyboard.push([
        setShowEditConfirmation.getBtn(
          ctx.t('show-edit-confirmation'),
          !config.show_edit_confirmation
        ),
      ]);
    }

    keyboard.push([mainMenuCb.getBtn(ctx.t('back-to-menu'))]);
  }

  return {
    text:
      `<b>${ctx.me.first_name} ${ctx.t('config')}</b>\n=============\n` +
      `<b>${ctx.t('default-checked-box')}</b>: ${
        config.default_checked_box
      }\n` +
      `<b>${ctx.t('default-unchecked-box')}</b>: ${
        config.default_unchecked_box
      }\n` +
      '\n' +
      `<i>${ctx.t('if-a-box-is-present-bot-will-prefer')}</i>`,
    keyboard,
  };
}

// TODO groups config
checkConfigModule.chatType('private').command('config', async (ctx) => {
  const { text, keyboard } = checkConfigMsg(ctx);
  await ctx.reply(text, ik(keyboard));
});

async function upsertConfig(ctx: MyContext, data: Partial<UserConfig>) {
  ctx.dbUser.config = await prisma.userConfig.upsert({
    where: { user_id: ctx.dbUser.id },
    create: { user_id: ctx.dbUser.id, ...getEmptyConfig(), ...data },
    update: { ...data },
  });
}

export const checkConfigMenu = new TgCallback('menu', async (ctx) => {
  const { text, keyboard } = checkConfigMsg(ctx);
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(ctx.t('config-btn'));
});

const pickDefaultCheckedBox = new TgCallback<[idx: number]>(
  'def-check',
  async (ctx) => {
    const [idx] = ctx.callbackParams;
    if (idx < 0 || idx >= suggestedCheckedBoxes.length) {
      return await ctx.answerCallbackQuery(ctx.t('invalid-choice'));
    }
    const picked = suggestedCheckedBoxes[idx];
    if (ctx.dbUser.config?.default_checked_box === picked) {
      return await ctx.answerCallbackQuery(ctx.t('default-already-set'));
    }
    await upsertConfig(ctx, { default_checked_box: picked });

    const { text, keyboard } = checkConfigMsg(ctx);
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(ctx.t('updated-preference'));
  }
);

const pickDefaultUncheckedBox = new TgCallback<[idx: number]>(
  'def-uncheck',
  async (ctx) => {
    const [idx] = ctx.callbackParams;
    if (idx < 0 || idx >= suggestedUncheckedBoxes.length) {
      return await ctx.answerCallbackQuery(ctx.t('invalid-choice'));
    }
    const picked = suggestedUncheckedBoxes[idx];
    if (ctx.dbUser.config?.default_checked_box === picked) {
      return await ctx.answerCallbackQuery(ctx.t('default-already-set'));
    }
    await upsertConfig(ctx, { default_unchecked_box: picked });

    const { text, keyboard } = checkConfigMsg(ctx);
    await ctx.editMessageText(text, ik(keyboard));
    await ctx.answerCallbackQuery(ctx.t('updated-preference'));
  }
);

async function updateUserLanguage(ctx: MyContext, code: string) {
  ctx.dbUser = await prisma.user.update({
    data: { language: code },
    where: { id: ctx.dbUser.id },
    include: { config: true },
  });
  await ctx.i18n.renegotiateLocale();
}

const pickLanguage = new TgCallback<[code: string]>('lang', async (ctx) => {
  const [languageCode] = ctx.callbackParams;
  const language = botLanguages.find((x) => x.code === languageCode);
  if (!language) {
    return await ctx.answerCallbackQuery(ctx.t('invalid-choice'));
  }
  if (ctx.dbUser.language === language.code) {
    return await ctx.answerCallbackQuery(ctx.t('language-already-set'));
  }
  await updateUserLanguage(ctx, language.code);

  const { text, keyboard } = checkConfigMsg(ctx);
  await ctx.editMessageText(text, ik(keyboard));
  await ctx.answerCallbackQuery(ctx.t('updated-language'));
});

export const setShowEditConfirmation = new TgCallback<
  [value: boolean, source?: 'never-show-again']
>('edit-conf', async (ctx) => {
  const [value, source] = ctx.callbackParams;
  if (ctx.dbUser.config?.show_edit_confirmation === value) {
    return await ctx.answerCallbackQuery(ctx.t('default-already-set'));
  }
  await upsertConfig(ctx, { show_edit_confirmation: value });

  if (source === 'never-show-again') {
    await ctx.editMessageText(
      `${ctx.t('i-will-not-show-again')}\n` +
        `<i>${ctx.t('you-can-show-again-in-config')}</i>`
    );
  } else {
    const { text, keyboard } = checkConfigMsg(ctx);
    await ctx.editMessageText(text, ik(keyboard));
  }

  await ctx.answerCallbackQuery(ctx.t('updated-preference'));
});

checkConfigModule
  .on('callback_query:data')
  .lazy(
    tgCallbackMiddleware(
      [
        pickDefaultCheckedBox,
        pickDefaultUncheckedBox,
        checkConfigMenu,
        pickLanguage,
        setShowEditConfirmation,
      ].map((x) => x.setPrefix('chk-conf'))
    )
  );
