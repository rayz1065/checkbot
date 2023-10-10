import { Api, Composer, GrammyError, InlineKeyboard } from 'grammy';
import { MyContext } from '../main';
import { TgError, escapeHtml, ik, makeId } from '../lib/utils';
import { Chat, InlineQueryResultsButton, Message } from 'grammy/types';
import {
  decodeDeepLinkParams,
  deepLinkUrl,
  encodeDeepLinkParams,
  startAppUrl,
} from '../lib/deep-linking';
import { getEmptyConfig, setShowEditConfirmation } from './check-config';
import {
  ChecklistData,
  extractCheckboxes,
  getInlineQueryCheckBoxes,
} from '../services/checklist-extractor';
import {
  ChecklistMessageLocation,
  LocationIdentifierAndIndex,
  UnsentChecklistLocation,
  formatCheckBoxLines,
  formatCheckBoxLinesNoHtml,
  getChecklistMessageText,
  getLocationIdentifier,
  parseLocationIdentifier,
  sendChecklist,
  updateChecklistMessage,
} from '../services/checklist-storage';

export const checkListModule = new Composer<MyContext>();
export const checkListChannelModule = new Composer<MyContext>();

function createChecklistAppButton(
  ctx: MyContext,
  location: UnsentChecklistLocation,
  checklistData: ChecklistData
) {
  const appData = JSON.stringify({
    location: encodeDeepLinkParams(
      getLocationIdentifier({ ...location, sourceMessageId: 0 })
    ),
    list: checklistData,
  });
  // TODO: a better encoding may allow for longer messages to be used here
  // for example just the location and text of the checklist can be passed
  const startApp = Buffer.from(appData).toString('base64url');

  if (startApp.length < 512) {
    return InlineKeyboard.url(
      `🤖 ${ctx.t('click-here-to-create-checklist')}`,
      startAppUrl(ctx.me, 'create_checklist', startApp)
    );
  }

  // url is too long, default to a url to start the bot
  return InlineKeyboard.url(
    `🤖 ${ctx.t('click-here-to-start')}`,
    deepLinkUrl(ctx.me, '')
  );
}

/**
 * Replies to a command or a pm message containing a checklist
 * with the generated checklist, internally uses sendChecklist
 * but contains extra logic related to user interaction
 */
const replyWithChecklist = async (
  ctx: MyContext & { message: Message } & { chat: Chat },
  checklistText: string
) => {
  if (ctx.message.via_bot?.id === ctx.me.id) {
    // this should have been responded to in 'chosen inline result'
    return;
  }
  const location: UnsentChecklistLocation = {
    sourceChatId: ctx.chat.id,
    salt: makeId(3),
  };
  if (ctx.message.has_protected_content) {
    if (ctx.message.from.id < 0) {
      return await ctx.reply(
        'This bot does not work in a group with protected content ' +
          'when used by an anonymous admin'
      );
    }
    location.foreignChatId = ctx.chat.id;
    location.sourceChatId = ctx.message.from.id;
  }

  const checklistData = extractCheckboxes(checklistText, ctx.dbUser.config);
  try {
    await sendChecklist(ctx.api, ctx.me, location, checklistData);
  } catch (error) {
    if (
      location.foreignChatId &&
      error instanceof GrammyError &&
      error.error_code == 403
    ) {
      const checklistText = formatCheckBoxLinesNoHtml(checklistData);
      return await ctx.api.sendMessage(
        location.foreignChatId,
        `${ctx.t('you-must-start-for-protected-content')}!\n` +
          `<i>📋 ${ctx.t('use-text-to-recreate-checklist')}</i>:\n\n` +
          `<code>${escapeHtml(checklistText)}</code>`,
        ik([[createChecklistAppButton(ctx, location, checklistData)]])
      );
    }

    return await ctx.reply(ctx.t('error-creating-checklist'));
  }
};

// 'check' command
checkListModule
  .chatType(['group', 'supergroup', 'private'])
  .command('check', async (ctx) => {
    if (ctx.match === '') {
      return await ctx.reply(ctx.t('check-command-usage'));
    }
    await replyWithChecklist(ctx, ctx.match);
  });

// message containing #check
checkListModule
  .chatType(['group', 'supergroup', 'private'])
  .on('message:text')
  .filter(
    // Only handle this message if it has a 'check' hashtag
    (ctx) => ctx.message.text.indexOf('#check') !== -1,
    (ctx) => replyWithChecklist(ctx, ctx.message.text)
  );

// private messages with checkboxes
checkListModule
  .chatType('private')
  .on('message:text')
  .filter(
    // Only handle this message if it has checkboxes
    (ctx) =>
      extractCheckboxes(ctx.message.text, ctx.dbUser.config).hasCheckBoxes,
    (ctx) => replyWithChecklist(ctx, ctx.message.text)
  );

checkListChannelModule
  .chatType('channel')
  .on(['channel_post:text', 'edited_channel_post:text'])
  .filter(
    (ctx) => ctx.msg.text.indexOf('#check') !== -1,
    async (ctx) => {
      if (ctx.msg.via_bot?.id === ctx.me.id) {
        // this should have been responded to in 'chosen inline result'
        return;
      }

      const checklistData = extractCheckboxes(ctx.msg.text, ctx.dbUser.config);
      const location: ChecklistMessageLocation = {
        sourceChatId: ctx.msg.chat.id,
        sourceMessageId: ctx.msg.message_id,
        salt: 'CHA',
      };

      await updateChecklistMessage(ctx.api, ctx.me, location, checklistData);
    }
  );

// inline query containing a checklist
checkListModule.inlineQuery(/^.+/, async (ctx) => {
  let inlineButton: InlineQueryResultsButton | undefined = undefined;
  if (ctx.inlineQuery.query.length >= 250) {
    inlineButton = {
      start_parameter: 'inline-too-long',
      text: 'Warning, inline query is too long!',
    };
  }
  const checklistData = getInlineQueryCheckBoxes(
    ctx.inlineQuery.query,
    ctx.dbUser.config
  );

  const keyboard = [
    [
      {
        text: `💭 ${ctx.t('generating-links')}... 🔗`,
        url: `tg://user?id=${ctx.me.id}`,
      },
    ],
  ];

  return await ctx.answerInlineQuery(
    [
      {
        id: 'checklist-shared',
        type: 'article',
        input_message_content: {
          message_text: formatCheckBoxLines(checklistData, () => ''),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        },
        ...ik(keyboard),
        title: ctx.t('shared-checklist'),
        description: formatCheckBoxLinesNoHtml(checklistData),
      },
      {
        id: 'checklist-personal',
        type: 'article',
        input_message_content: {
          message_text: formatCheckBoxLines(checklistData, () => ''),
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        },
        ...ik(keyboard),
        title: ctx.t('personal-checklist'),
        description: formatCheckBoxLinesNoHtml(checklistData),
      },
    ],
    {
      cache_time: -1,
      button: inlineButton,
    }
  );
});

// deal with a chosen inline query
checkListModule.on('chosen_inline_result').filter(
  (ctx) => ctx.chosenInlineResult.result_id.startsWith('checklist'),
  async (ctx) => {
    const checklistData = getInlineQueryCheckBoxes(
      ctx.chosenInlineResult.query,
      ctx.dbUser.config
    );
    const inlineMessageId = ctx.chosenInlineResult.inline_message_id;
    if (!inlineMessageId) {
      return console.error('Failed to get inline message id', ctx);
    }

    const location = {
      sourceChatId: ctx.from.id,
      inlineMessageId: inlineMessageId,
      salt: makeId(3),
      isPersonal: ctx.chosenInlineResult.result_id === 'checklist-personal',
    };
    try {
      await sendChecklist(ctx.api, ctx.me, location, checklistData);
    } catch (error) {
      if (error instanceof GrammyError && error.error_code == 403) {
        const checklistText = formatCheckBoxLinesNoHtml(checklistData);
        return await ctx.api.editMessageTextInline(
          inlineMessageId,
          `${ctx.t('you-must-start-for-inline-mode')}!\n` +
            `<i>📋 ${ctx.t('use-text-to-recreate-checklist')}</i>:\n\n` +
            `<code>${escapeHtml(checklistText)}</code>`,
          ik([[createChecklistAppButton(ctx, location, checklistData)]])
        );
      }
      return await ctx.api.editMessageTextInline(
        inlineMessageId,
        ctx.t('error-creating-checklist')
      );
    }
  }
);

/**
 * Checks the permissions of a user to access a checklist
 * Note: since the location is always parsed from a `LocationIdentifier`
 * is is assumed that the signature test already passed here
 */
export async function checkChecklistPermissions(
  api: Api,
  telegramUserId: number,
  location: ChecklistMessageLocation
) {
  const { sourceChatId, foreignChatId, inlineMessageId } = location;
  const chatToCheck = foreignChatId ?? sourceChatId;
  if (chatToCheck < 0 && chatToCheck !== telegramUserId) {
    // This is a group or channel chat, check if the user is in the chat
    let chatMemberStatus: string;
    try {
      const chatMember = await api.getChatMember(chatToCheck, telegramUserId);
      chatMemberStatus = chatMember.status;
    } catch (error) {
      // ignore errors to avoid giving information to a malicious user
      chatMemberStatus = 'restricted';
    }
    // NOTE: this will not work if the chat list is hidden from the user
    // or if the user is an anonymous admin.
    // Putting the bot admin will fix this.
    // #TODO: make list of allowed statuses configurable
    const allowedStatuses = ['creator', 'administrator', 'member'];
    if (allowedStatuses.indexOf(chatMemberStatus) === -1) {
      throw new TgError('no-rights-to-edit-group-checklist');
    }

    if (chatMemberStatus === 'member') {
      const chatType = (await api.getChat(chatToCheck)).type;
      if (chatType === 'channel') {
        throw new TgError('you-are-not-administrator');
      }
    }
  } else if (chatToCheck !== telegramUserId) {
    // If this is an inline message we need to check the hash
    if (!inlineMessageId) {
      throw new TgError('no-rights-to-edit-checklist');
    }
    // An inline message can be changed by anyone who has access to it
    // At this point the signature challenge has already been passed
    if (location.isPersonal) {
      throw new TgError('checklist-is-personal');
    }
  }
}

// update a checklist
checkListModule
  .on('message')
  .command('start')
  .filter(
    (ctx) => ctx.match.startsWith('t_'),
    async (ctx) => {
      let location: ChecklistMessageLocation;
      let checkBoxIdx: number;

      try {
        const splits = decodeDeepLinkParams(
          ctx.match
        ) as LocationIdentifierAndIndex;
        location = parseLocationIdentifier(splits);
        checkBoxIdx = parseInt(splits.at(-1)!, 36);

        if (isNaN(checkBoxIdx) || checkBoxIdx < 0) {
          throw new TgError('error-parsing-command');
        }
      } catch (error) {
        return await ctx.reply('Error parsing command...');
      }

      const { sourceChatId, inlineMessageId, foreignChatId } = location;

      // Check the permissions for the checklist
      try {
        await checkChecklistPermissions(ctx.api, ctx.from.id, location);
      } catch (error) {
        const prettyError =
          error instanceof TgError
            ? ctx.t(error.message)
            : 'There was an error while checking the permissions';
        return await ctx.reply(prettyError);
      }

      // Get contents of the checklist
      let checklistData: ChecklistData;
      try {
        checklistData = extractCheckboxes(
          await getChecklistMessageText(ctx.api, ctx.chat.id, location),
          ctx.dbUser.config
        );
      } catch (error) {
        const prettyError =
          error instanceof TgError
            ? ctx.t(error.message)
            : 'There was an error while getting the contents of the checklist';
        return await ctx.reply(prettyError);
      }

      // update checklist
      const { lines } = checklistData;
      if (lines.length <= checkBoxIdx || !lines[checkBoxIdx].hasCheckBox) {
        return await ctx.reply('Invalid checkbox idx');
      }

      lines[checkBoxIdx].isChecked = !lines[checkBoxIdx].isChecked;

      // send the new checklist
      await updateChecklistMessage(ctx.api, ctx.me, location, checklistData);

      // the confirmation is shown to users that did not disable it,
      // for checklists that are mirrored in other chats, like inline and foreign
      const userConfig = ctx.dbUser.config ?? getEmptyConfig();
      const isPrivateChecklist =
        sourceChatId === ctx.chat.id && !inlineMessageId && !foreignChatId;
      if (!isPrivateChecklist && userConfig.show_edit_confirmation) {
        await ctx.reply(
          `${checklistData.checkedBoxStyle} ${ctx.t('done-press-back')}`,
          {
            disable_notification: true,
            ...ik([
              [
                setShowEditConfirmation.getBtn(
                  ctx.t('never-show-again'),
                  false,
                  'never-show-again'
                ),
              ],
            ]),
          }
        );
      } else {
        ctx.deleteMessage().catch(() => {
          // error does not need to be handled
        });
      }
    }
  );
