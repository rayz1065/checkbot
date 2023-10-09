import { Api, Composer, GrammyError, InlineKeyboard } from 'grammy';
import { MyContext } from '../main';
import { TgError, escapeHtml, ik, makeId } from '../lib/utils';
import {
  Chat,
  InlineQueryResultsButton,
  Message,
  UserFromGetMe,
} from 'grammy/types';
import crypto from 'crypto';
import assert from 'assert';
import {
  decodeDeepLinkParams,
  encodeDeepLinkParams,
  encodeDeepLinkUrl,
  encodeStartAppUrl,
} from '../lib/deep-linking';
import base from 'base-x';
import { getEmptyConfig, setShowEditConfirmation } from './check-config';
import { UserConfig } from '@prisma/client';
const base62 = base(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
);

export type CheckBoxLine =
  | {
      hasCheckBox: false;
      isChecked?: false;
      text: string;
    }
  | {
      hasCheckBox: true;
      isChecked: boolean;
      text: string;
    };

interface ChecklistData {
  hasCheckBoxes: boolean;
  lines: CheckBoxLine[];
  checkedBoxStyle: string;
  uncheckedBoxStyle: string;
}

export interface ChecklistMessageLocation {
  sourceChatId: number;
  sourceMessageId: number;
  salt: string;
  foreignChatId?: number;
  foreignMessageId?: number;
  inlineMessageId?: string;
  isPersonal?: boolean;
}

type LocationIdentifier =
  | [
      't',
      'i' | 'j',
      sourceChatId: string,
      sourceMessageId: string,
      inlineMessageId: string,
      signature: string
    ]
  | [
      't',
      'f',
      sourceChatId: string,
      sourceMessageId: string,
      foreignChatId: string,
      foreignMessageId: string,
      signature: string
    ]
  | [
      't',
      'c',
      sourceChatId: string,
      sourceMessageId: string,
      signature: string
    ];
type LocationIdentifierAndIndex = [...LocationIdentifier, lineIdx: string];

export const checkListModule = new Composer<MyContext>();
export const checkListChannelModule = new Composer<MyContext>();

export const suggestedCheckedBoxes = ['✅', '☑️', '✔️'];
export const suggestedUncheckedBoxes = ['- [ ]', '- [  ]', '- [   ]'];
export const checkedBoxes = [...suggestedCheckedBoxes, '- [x]', '☑', '✔'];

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function isLineChecked(line: string) {
  const match = line.match(/^\s*(-?\s*\[\s*x\s*\])\s*/);
  if (match) {
    return {
      matched: match[1],
      normalized: '- [x]',
    };
  }

  for (const box of checkedBoxes) {
    if (line.trimStart().startsWith(box)) {
      return {
        matched: box,
        normalized: box,
      };
    }
  }
  return null;
}

function isLineUnchecked(line: string) {
  // if a match is found, it is normalized to make it have between 1 and 3 spaces
  const match = line.match(/^\s*(-?\s*\[(\s*)\]|-)\s*/);
  if (!match) {
    return null;
  }
  const spacesCount = Math.max(1, Math.min(3, match[2]?.length ?? 0));
  const normalized = '- [' + ' '.repeat(spacesCount) + ']';
  return {
    matched: match[1],
    normalized,
  };
}

export function extractCheckboxes(messageText: string) {
  const lines = messageText.split('\n');
  let hasCheckBoxes = false;
  let checkedBoxStyle: string | null = null;
  let uncheckedBoxStyle: string | null = null;
  const resultingLines: CheckBoxLine[] = [];

  for (const line of lines) {
    const checkedBox = isLineChecked(line);
    const uncheckedBox = isLineUnchecked(line);
    if (!checkedBox && !uncheckedBox) {
      resultingLines.push({
        hasCheckBox: false,
        text: line,
      });
      continue;
    }

    hasCheckBoxes = true;
    let checkboxText = '';
    const isChecked = checkedBox !== null;

    if (isChecked) {
      checkedBoxStyle = checkedBoxStyle ?? checkedBox.normalized;
    } else {
      uncheckedBoxStyle = uncheckedBoxStyle ?? uncheckedBox!.normalized;
    }

    const usedCheckBox = (isChecked ? checkedBox : uncheckedBox)!;
    checkboxText = line.replace(
      new RegExp(`^\\s*${escapeRegExp(usedCheckBox.matched)}\\s*`),
      ''
    );

    resultingLines.push({
      hasCheckBox: true,
      isChecked: isChecked,
      text: checkboxText,
    });
  }

  return {
    hasCheckBoxes,
    lines: resultingLines,
    checkedBoxStyle,
    uncheckedBoxStyle,
  };
}

function configExtractCheckboxes(
  messageText: string,
  config: UserConfig | null
): ChecklistData {
  let { checkedBoxStyle, uncheckedBoxStyle, ...etc } =
    extractCheckboxes(messageText);
  const usedConfig = config ?? getEmptyConfig();
  checkedBoxStyle ??= usedConfig.default_checked_box;
  uncheckedBoxStyle ??= usedConfig.default_unchecked_box;

  return { ...etc, checkedBoxStyle, uncheckedBoxStyle };
}

function formatCheckBoxLines(
  checklistData: ChecklistData,
  toggleUrl: (idx: number) => string
) {
  const { lines, checkedBoxStyle, uncheckedBoxStyle } = checklistData;
  const resultingLines = lines.map((line, idx) => {
    if (!line.hasCheckBox) {
      return escapeHtml(line.text);
    }
    const checkBoxStyle = line.isChecked ? checkedBoxStyle : uncheckedBoxStyle;
    const itemText = line.isChecked
      ? `<s>${escapeHtml(line.text)}</s>`
      : escapeHtml(line.text);
    // Space is in URL to make it simpler to click
    return `<a href="${toggleUrl(idx)}">${checkBoxStyle} </a>${itemText}`;
  });

  return resultingLines.join('\n');
}

function formatCheckBoxLinesNoHtml(checklistData: ChecklistData) {
  const { lines, checkedBoxStyle, uncheckedBoxStyle } = checklistData;
  const resultingLines = lines.map((line) => {
    if (!line.hasCheckBox) {
      return line.text;
    }
    const checkBoxStyle = line.isChecked ? checkedBoxStyle : uncheckedBoxStyle;
    const itemText = line.text;
    return `${checkBoxStyle} ${itemText}`;
  });
  return resultingLines.join('\n');
}

function getLocationIdentifier(
  location: ChecklistMessageLocation
): LocationIdentifier {
  const {
    sourceChatId,
    sourceMessageId,
    inlineMessageId,
    foreignChatId,
    foreignMessageId,
    isPersonal,
  } = location;

  if (inlineMessageId) {
    return [
      't',
      isPersonal ? 'j' : 'i',
      sourceChatId.toString(36),
      sourceMessageId.toString(36),
      inlineMessageId,
      computeLocationSignature(location),
    ];
  }

  if (foreignChatId && foreignMessageId) {
    return [
      't',
      'f',
      sourceChatId.toString(36),
      sourceMessageId.toString(36),
      foreignChatId.toString(36),
      foreignMessageId.toString(36),
      computeLocationSignature(location),
    ];
  }

  return [
    't',
    'c',
    sourceChatId.toString(36),
    sourceMessageId.toString(36),
    computeLocationSignature(location),
  ];
}

function checklistUrl(me: UserFromGetMe, location: ChecklistMessageLocation) {
  const locationIdentifier = getLocationIdentifier(location);
  return (idx: number) =>
    encodeDeepLinkUrl(me, [...locationIdentifier, idx.toString(36)]);
}

function computeLocationSignature(location: ChecklistMessageLocation) {
  // make sure the same stringified version is always consistent
  const stringifiedLocation = JSON.stringify([
    location.sourceChatId,
    location.inlineMessageId,
    location.inlineMessageId,
    location.foreignChatId,
    location.foreignMessageId,
    location.salt,
  ]);

  assert(process.env.CHECKBOX_HMAC_SECRET);

  const hashResult = crypto
    .createHmac('sha256', process.env.CHECKBOX_HMAC_SECRET)
    .update(stringifiedLocation)
    .digest();
  const hashedLocation = base62.encode(hashResult);

  return `${location.salt}${hashedLocation.substring(0, 12)}`;
}

export function parseLocationIdentifier(splits: string[]) {
  const location: ChecklistMessageLocation = {
    sourceChatId: NaN,
    sourceMessageId: NaN,
    salt: '',
  };
  let signature: string;

  if (splits.length >= 5 && splits[1] === 'c') {
    location.sourceChatId = parseInt(splits[2], 36);
    location.sourceMessageId = parseInt(splits[3], 36);
    signature = splits[4];
  } else if (splits.length >= 6 && ['i', 'j'].indexOf(splits[1]) !== -1) {
    location.isPersonal = splits[1] === 'j';
    location.sourceChatId = parseInt(splits[2], 36);
    location.sourceMessageId = parseInt(splits[3], 36);
    location.inlineMessageId = splits[4];
    signature = splits[5];
  } else if (splits.length >= 7 && splits[1] === 'f') {
    location.sourceChatId = parseInt(splits[2], 36);
    location.sourceMessageId = parseInt(splits[3], 36);
    location.foreignChatId = parseInt(splits[4], 36);
    location.foreignMessageId = parseInt(splits[5], 36);
    signature = splits[6];
  } else {
    throw new Error('Failed to parse command');
  }

  location.salt = signature.substring(0, 3);

  if (
    isNaN(location.sourceChatId) ||
    isNaN(location.sourceMessageId) ||
    Number.isNaN(location.foreignChatId) ||
    Number.isNaN(location.foreignMessageId) ||
    computeLocationSignature(location) !== signature
  ) {
    throw new Error('Failed to parse command');
  }

  return location;
}

/**
 * Used in private chats, groups, and inline mode
 */
async function sendChecklist(
  ctx: MyContext,
  checklistData: ChecklistData,
  location: Omit<ChecklistMessageLocation, 'sourceMessageId'>
) {
  const normalizedText = formatCheckBoxLines(
    checklistData,
    () => '' // no URL is available yet
  );
  const { sourceChatId, foreignChatId } = location;
  const checklistMessage = await ctx.api.sendMessage(
    sourceChatId,
    normalizedText,
    { disable_web_page_preview: true }
  );
  const sourceMessageId = checklistMessage.message_id;
  const completeLocation: ChecklistMessageLocation = {
    ...location,
    sourceMessageId,
  };

  if (foreignChatId) {
    // get a foreignMessageId
    const foreignChecklistMessage = await ctx.api.sendMessage(
      foreignChatId,
      normalizedText,
      { disable_web_page_preview: true }
    );
    completeLocation.foreignMessageId = foreignChecklistMessage.message_id;
  }

  // edit the message now that the URL is available
  await updateChecklistMessage(
    ctx.api,
    ctx.me,
    completeLocation,
    checklistData
  );

  return { completeLocation, checklistData };
}

const replyWithChecklist = async (
  ctx: MyContext & { message: Message } & { chat: Chat },
  checklistText: string
) => {
  if (ctx.message.via_bot?.id === ctx.me.id) {
    // this should have been responded to in 'chosen inline result'
    return;
  }
  const location: Omit<ChecklistMessageLocation, 'sourceMessageId'> = {
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

  const checklistData = configExtractCheckboxes(
    checklistText,
    ctx.dbUser.config
  );
  try {
    await sendChecklist(ctx, checklistData, location);
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
        ik([
          [
            {
              text: `🤖 ${ctx.t('click-here-to-start')}`,
              url: `https://t.me/${ctx.me.username}`,
            },
          ],
        ])
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
      configExtractCheckboxes(ctx.message.text, ctx.dbUser.config)
        .hasCheckBoxes,
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

      const checklistData = configExtractCheckboxes(
        ctx.msg.text,
        ctx.dbUser.config
      );
      const location: ChecklistMessageLocation = {
        sourceChatId: ctx.msg.chat.id,
        sourceMessageId: ctx.msg.message_id,
        salt: 'CHA',
      };
      const checklistText = formatCheckBoxLines(
        checklistData,
        checklistUrl(ctx.me, location)
      );

      await ctx.api.editMessageText(
        location.sourceChatId,
        location.sourceMessageId,
        checklistText,
        { disable_web_page_preview: true }
      );
    }
  );

function getInlineQueryCheckBoxes(ctx: MyContext) {
  // replaces lines which are not checkboxes with an unchecked line
  const text = (ctx.inlineQuery ?? ctx.chosenInlineResult)!.query;
  const items = text
    .split('\n')
    .filter((x) => x.length > 0)
    .map((x) => (isLineChecked(x) || isLineUnchecked(x) ? x : `- [ ] ${x}`));
  return configExtractCheckboxes(items.join('\n'), ctx.dbUser.config);
}

checkListModule.inlineQuery(/^.+/, async (ctx) => {
  let inlineButton: InlineQueryResultsButton | undefined = undefined;
  if (ctx.inlineQuery.query.length >= 250) {
    inlineButton = {
      start_parameter: 'inline-too-long',
      text: 'Warning, inline query is too long!',
    };
  }
  const checklistData = getInlineQueryCheckBoxes(ctx);

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
    const checklistData = getInlineQueryCheckBoxes(ctx);
    const inlineMessageId = ctx.chosenInlineResult.inline_message_id;
    if (!inlineMessageId) {
      return console.error('Failed to get inline message id', ctx);
    }

    try {
      await sendChecklist(ctx, checklistData, {
        sourceChatId: ctx.from.id,
        inlineMessageId: inlineMessageId,
        salt: makeId(3),
        isPersonal: ctx.chosenInlineResult.result_id === 'checklist-personal',
      });
    } catch (error) {
      if (error instanceof GrammyError && error.error_code == 403) {
        const checklistText = formatCheckBoxLinesNoHtml(checklistData);
        return await ctx.api.editMessageTextInline(
          inlineMessageId,
          `${ctx.t('you-must-start-for-inline-mode')}!\n` +
            `<i>📋 ${ctx.t('use-text-to-recreate-checklist')}</i>:\n\n` +
            `<code>${escapeHtml(checklistText)}</code>`,
          ik([
            [
              {
                text: `🤖 ${ctx.t('click-here-to-start')}`,
                url: `https://t.me/${ctx.me.username}`,
              },
            ],
          ])
        );
      }
      return await ctx.api.editMessageTextInline(
        inlineMessageId,
        ctx.t('error-creating-checklist')
      );
    }

    // await ctx.api.editMessageTextInline(inlineMessageId, checklistText, {
    //   disable_web_page_preview: true,
    // });
  }
);

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

/**
 * Reads a checklist message and returns the checklist data
 *
 * @throws TgError
 */
export async function getChecklistMessageText(
  api: Api,
  temporaryChatId: number,
  location: ChecklistMessageLocation
) {
  let checklistMessage: Message;

  try {
    const { sourceChatId, sourceMessageId } = location;
    checklistMessage = await api.forwardMessage(
      temporaryChatId,
      sourceChatId,
      sourceMessageId,
      { disable_notification: true }
    );
  } catch (error) {
    if (error instanceof GrammyError) {
      throw new TgError('failed-to-read-checklist-error', {
        message: error.message,
      });
    }
    console.error('Failed to read checklist', error);
    throw new TgError('failed-to-read-checklist-unknown');
  }

  if (!checklistMessage.text) {
    throw new TgError('failed-to-read-checklist');
  }

  api.deleteMessage(temporaryChatId, checklistMessage.message_id).catch(() => {
    // An error here is ignored
  });

  return checklistMessage.text ?? checklistMessage.caption ?? '';
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
        checklistData = configExtractCheckboxes(
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

export async function updateChecklistMessage(
  api: Api,
  me: UserFromGetMe,
  location: ChecklistMessageLocation,
  checklistData: ChecklistData
) {
  const {
    inlineMessageId,
    foreignChatId,
    foreignMessageId,
    sourceChatId,
    sourceMessageId,
  } = location;
  const urlGenerator = checklistUrl(me, location);
  const checklistText = formatCheckBoxLines(checklistData, urlGenerator);

  api
    .editMessageText(sourceChatId, sourceMessageId, checklistText, {
      disable_web_page_preview: true,
      parse_mode: 'HTML',
      ...ik([
        sourceChatId > 0
          ? [
              InlineKeyboard.webApp(
                '✏️',
                `https://${
                  process.env.WEB_APP_URL
                }/?tgWebAppStartParam=${encodeDeepLinkParams(
                  getLocationIdentifier(location)
                )}&list=${encodeURIComponent(JSON.stringify(checklistData))}`
              ),
            ]
          : [
              InlineKeyboard.url(
                '✏️',
                encodeStartAppUrl(
                  me,
                  'edit_checklist',
                  getLocationIdentifier(location)
                )
              ),
            ],
      ]),
    })
    .catch(() => {
      // may fail if the message has been deleted
    });

  // update the inline message if available
  if (inlineMessageId !== undefined) {
    api
      .editMessageTextInline(inlineMessageId, checklistText, {
        disable_web_page_preview: true,
        parse_mode: 'HTML',
        ...ik([
          [
            InlineKeyboard.url(
              '✏️',
              encodeStartAppUrl(
                me,
                'edit_checklist',
                getLocationIdentifier(location)
              )
            ),
          ],
        ]),
      })
      .catch(() => {
        // May fail if the message has been deleted
      });
  } else if (foreignChatId && foreignMessageId !== undefined) {
    api
      .editMessageText(foreignChatId, foreignMessageId, checklistText, {
        disable_web_page_preview: true,
        parse_mode: 'HTML',
        ...ik([
          [
            InlineKeyboard.url(
              '✏️',
              encodeStartAppUrl(
                me,
                'edit_checklist',
                getLocationIdentifier(location)
              )
            ),
          ],
        ]),
      })
      .catch(() => {
        // May fail if the message has been deleted
      });
  }
}
