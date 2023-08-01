import { Composer, GrammyError } from 'grammy';
import { MyContext, prisma } from '../main';
import { TgError, escapeHtml, ik } from '../lib/utils';
import { Chat, Message } from 'grammy/types';
import crypto from 'crypto';
import assert from 'assert';

type CheckBoxLine =
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

interface ChecklistMessageLocation {
  sourceChatId: number;
  sourceMessageId: number;
  foreignChatId?: number;
  foreignMessageId?: number;
  inlineMessageId?: string;
}

export const checkListModule = new Composer<MyContext>();
export const checkListChannelModule = new Composer<MyContext>();

const checkedBoxes = ['✅', '☑️', '✔️', '- [x]', '☑', '✔'];
const uncheckedBoxes = ['- [ ]'];

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

function extractCheckboxes(messageText: string): ChecklistData {
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

  checkedBoxStyle = checkedBoxStyle ?? checkedBoxes[0];
  uncheckedBoxStyle = uncheckedBoxStyle ?? uncheckedBoxes[0];
  if (uncheckedBoxStyle === '-') {
    // This box is too hard to click
    uncheckedBoxStyle = uncheckedBoxes[0];
  }

  return {
    hasCheckBoxes,
    lines: resultingLines,
    checkedBoxStyle,
    uncheckedBoxStyle,
  };
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

function checklistUrl(ctx: MyContext, location: ChecklistMessageLocation) {
  const {
    sourceChatId,
    sourceMessageId,
    inlineMessageId,
    foreignChatId,
    foreignMessageId,
  } = location;

  if (inlineMessageId) {
    return (idx: number) =>
      `https://t.me/${ctx.me.username}?start=t_i_${sourceChatId}_${sourceMessageId}_${idx}_${inlineMessageId}`;
  }

  if (foreignChatId) {
    return (idx: number) =>
      `https://t.me/${ctx.me.username}?start=t_f_${sourceChatId}_${sourceMessageId}_${idx}_${foreignChatId}_${foreignMessageId}`;
  }

  return (idx: number) =>
    `https://t.me/${ctx.me.username}?start=t_c_${sourceChatId}_${sourceMessageId}_${idx}`;
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
    normalizedText
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
      normalizedText
    );
    completeLocation.foreignMessageId = foreignChecklistMessage.message_id;
  }

  // edit the message now that the URL is available
  const urlGenerator = checklistUrl(ctx, completeLocation);
  const checklistText = formatCheckBoxLines(checklistData, urlGenerator);

  await ctx.api.editMessageText(sourceChatId, sourceMessageId, checklistText);

  if (foreignChatId && completeLocation.foreignMessageId) {
    await ctx.api.editMessageText(
      foreignChatId,
      completeLocation.foreignMessageId,
      checklistText
    );
  }

  return { completeLocation, checklistText };
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
  };
  if (ctx.message.has_protected_content) {
    if (ctx.message.from.id < 0) {
      return await ctx.reply(
        'This bot does not work in a group with protected content ' +
          'when used by an anonymous admin, use inline mode instead'
      );
    }
    location.foreignChatId = ctx.chat.id;
    location.sourceChatId = ctx.message.from.id;
  }

  const checklistData = extractCheckboxes(checklistText);
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
        'You must start the bot for it to work in a group with protected content!\n' +
          '<i>📋 Use the text below to recreate your checklist</i>:\n\n' +
          `<code>${escapeHtml(checklistText)}</code>`,
        ik([
          [
            {
              text: '🤖 Click here to start the bot',
              url: `https://t.me/${ctx.me.username}`,
            },
          ],
        ])
      );
    }

    return await ctx.reply('There was an error creating the checklist');
  }
};

// private messages with checkboxes
checkListModule
  .chatType('private')
  .on('message:text')
  .filter(
    // Only handle this message if it has checkboxes
    (ctx) => extractCheckboxes(ctx.message.text).hasCheckBoxes,
    (ctx) => replyWithChecklist(ctx, ctx.message.text)
  );

// 'check' command
checkListModule
  .chatType(['group', 'supergroup', 'private'])
  .command('check', (ctx) => replyWithChecklist(ctx, ctx.match));

// message containing #check in a group
checkListModule
  .chatType(['group', 'supergroup'])
  .on('message:text')
  .filter(
    // Only handle this message if it has a 'check' hashtag
    (ctx) => ctx.message.text.indexOf('#check') !== -1,
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

      const checklistData = extractCheckboxes(ctx.msg.text);
      const location: ChecklistMessageLocation = {
        sourceChatId: ctx.msg.chat.id,
        sourceMessageId: ctx.msg.message_id,
      };
      const checklistText = formatCheckBoxLines(
        checklistData,
        checklistUrl(ctx, location)
      );

      await ctx.api.editMessageText(
        location.sourceChatId,
        location.sourceMessageId,
        checklistText
      );
    }
  );

function getInlineQueryCheckBoxes(text: string) {
  // replaces lines which are not checkboxes with an unchecked line
  const items = text
    .split('\n')
    .filter((x) => x.length > 0)
    .map((x) => (isLineChecked(x) || isLineUnchecked(x) ? x : `- [ ] ${x}`));
  return extractCheckboxes(items.join('\n'));
}

checkListModule.inlineQuery(/^.+/, async (ctx) => {
  let switchPmText: string | undefined = undefined;
  if (ctx.inlineQuery.query.length >= 250) {
    switchPmText = 'Warning, inline query is too long!';
  }
  const checklistData = getInlineQueryCheckBoxes(ctx.inlineQuery.query);

  return await ctx.answerInlineQuery(
    [
      {
        id: 'checklist',
        type: 'article',
        input_message_content: {
          message_text: formatCheckBoxLines(checklistData, () => ''),
          parse_mode: 'HTML',
        },
        ...ik([
          [
            {
              text: '💭 Generating links... 🔗',
              url: `tg://user?id=${ctx.me.id}`,
            },
          ],
        ]),
        title: 'Send checklist',
        description: formatCheckBoxLinesNoHtml(checklistData),
      },
    ],
    {
      cache_time: -1,
      switch_pm_text: switchPmText,
      switch_pm_parameter: 'inline-too-long',
    }
  );
});

function makeInlineMessageHash(location: ChecklistMessageLocation) {
  const { sourceChatId, sourceMessageId, inlineMessageId } = location;
  const messageKey = `${sourceChatId}:${sourceMessageId}:${inlineMessageId}`;
  return crypto
    .createHash('sha256')
    .update(messageKey, 'utf8')
    .digest()
    .toString('hex');
}

// deal with a chosen inline query
checkListModule.on('chosen_inline_result').filter(
  (ctx) => ctx.chosenInlineResult.result_id === 'checklist',
  async (ctx) => {
    const checklistData = getInlineQueryCheckBoxes(
      ctx.chosenInlineResult.query
    );
    const inlineMessageId = ctx.chosenInlineResult.inline_message_id;
    if (!inlineMessageId) {
      return console.error('Failed to get inline message id', ctx);
    }

    let location: ChecklistMessageLocation;
    let checklistText: string;
    try {
      const res = await sendChecklist(ctx, checklistData, {
        sourceChatId: ctx.from.id,
        inlineMessageId: inlineMessageId,
      });
      location = res.completeLocation;
      checklistText = res.checklistText;
    } catch (error) {
      if (error instanceof GrammyError && error.error_code == 403) {
        checklistText = formatCheckBoxLinesNoHtml(checklistData);
        return await ctx.api.editMessageTextInline(
          inlineMessageId,
          'You must start the bot for it to work!\n' +
            '<i>📋 Use the text below to recreate your checklist</i>:\n\n' +
            `<code>${escapeHtml(checklistText)}</code>`,
          ik([
            [
              {
                text: '🤖 Click here to start the bot',
                url: `https://t.me/${ctx.me.username}`,
              },
            ],
          ])
        );
      }
      return await ctx.api.editMessageTextInline(
        inlineMessageId,
        'There was an error creating the checklist'
      );
    }

    // create a new hash, to check if the user has access to the inline message
    const inlineHash = makeInlineMessageHash(location);
    await prisma.inlineChecklistHash.create({
      data: { hash: inlineHash },
    });

    await ctx.api.editMessageTextInline(inlineMessageId, checklistText);
  }
);

async function checkChecklistPermissions(
  ctx: MyContext,
  location: ChecklistMessageLocation
) {
  const { sourceChatId, foreignChatId, inlineMessageId } = location;
  assert(ctx.from);
  const chatToCheck = foreignChatId ?? sourceChatId;
  if (chatToCheck < 0 && chatToCheck !== ctx.from.id) {
    // This is a group or channel chat, check if the user is in the chat
    let chatMemberStatus: string;
    try {
      const chatMember = await ctx.api.getChatMember(chatToCheck, ctx.from.id);
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
      throw new TgError(
        `You do not have the rights to edit this checklist (maybe you're an anonymous admin, ` +
          `maybe the bot has no access to the members of the chat, make the bot administrator to fix this)`
      );
    }

    if (chatMemberStatus === 'member') {
      const chatType = (await ctx.api.getChat(chatToCheck)).type;
      if (chatType === 'channel') {
        throw new TgError(
          'You are not administrator in this channel and cannot edit the checklist'
        );
      }
    }
  } else if (chatToCheck !== ctx.from.id) {
    // If this is an inline message we need to check the hash
    if (!inlineMessageId) {
      throw new TgError('You do not have the rights to edit this checklist');
    }
    const checklistHash = makeInlineMessageHash(location);
    // If the hash is found in the database, the user is trusted to have access
    // to the inline message id and the rest of the code runs as normal
    const dbHash = await prisma.inlineChecklistHash.findFirst({
      where: { hash: checklistHash },
    });
    if (!dbHash) {
      // Checklist hash not found, this checklist probably does not exist
      throw new TgError('You do not have the rights to edit this checklist');
    }
  }
}

/**
 * Forwards a temporary message, remember to delete it after.
 *
 * @throws TgError
 */
async function getChecklistMessage(
  ctx: MyContext,
  temporaryChatId: number,
  location: ChecklistMessageLocation
) {
  let checklistMessage: Message;

  try {
    const { sourceChatId, sourceMessageId } = location;
    checklistMessage = await ctx.api.forwardMessage(
      temporaryChatId,
      sourceChatId,
      sourceMessageId,
      { disable_notification: true }
    );
  } catch (error) {
    if (error instanceof GrammyError) {
      throw new TgError(
        `Failed to read checklist contents due to error: <code>${error.message}</code>`
      );
    }
    console.error('Failed to read checklist', error);
    throw new TgError('Failed to read checklist contents due to unknown error');
  }

  if (!checklistMessage.text) {
    throw new TgError('Failed to read checklist contents');
  }

  return {
    checklistMessage: checklistMessage as Message & { text: string },
    cleanTemporaryMessage: async () => {
      await ctx.api.deleteMessage(temporaryChatId, checklistMessage.message_id);
    },
  };
}

// update a checklist
checkListModule
  .on('message')
  .command('start')
  .filter(
    (ctx) => ctx.match.startsWith('t_'),
    async (ctx) => {
      const splits = ctx.match.match(
        /^t_([cif])_(-?\d+)_(\d+)_(\d+)(?:_(-?\d+|.+))?(?:_(\d+))?$/
      );
      const location: ChecklistMessageLocation = {
        sourceChatId: NaN,
        sourceMessageId: NaN,
      };
      let checkBoxIdx = NaN;

      if (splits && splits[1] === 'c') {
        const splits = ctx.match.split('_');
        location.sourceChatId = parseInt(splits[2], 10);
        location.sourceMessageId = parseInt(splits[3], 10);
        checkBoxIdx = parseInt(splits[4], 10);
      } else if (splits && splits[1] === 'i') {
        location.sourceChatId = parseInt(splits[2], 10);
        location.sourceMessageId = parseInt(splits[3], 10);
        checkBoxIdx = parseInt(splits[4], 10);
        location.inlineMessageId = splits[5];
      } else if (splits && splits[1] == 'f') {
        const splits = ctx.match.split('_');
        location.sourceChatId = parseInt(splits[2], 10);
        location.sourceMessageId = parseInt(splits[3], 10);
        checkBoxIdx = parseInt(splits[4], 10);
        location.foreignChatId = parseInt(splits[5], 10);
        location.foreignMessageId = parseInt(splits[6], 10);
      }

      const {
        sourceChatId,
        sourceMessageId,
        inlineMessageId,
        foreignChatId,
        foreignMessageId,
      } = location;
      if (
        isNaN(sourceChatId) ||
        isNaN(sourceMessageId) ||
        isNaN(checkBoxIdx) ||
        checkBoxIdx < 0 ||
        Number.isNaN(foreignChatId) ||
        Number.isNaN(foreignMessageId)
      ) {
        console.log({ location, splits });
        return await ctx.reply('Error parsing command...');
      }

      // Check the permissions for the checklist
      try {
        await checkChecklistPermissions(ctx, location);
      } catch (error) {
        const prettyError =
          error instanceof TgError
            ? error.message
            : 'There was an error while checking the permissions';
        return await ctx.reply(prettyError);
      }

      // Get contents of the checklist
      let checklistMessage: Message & { text: string };
      let cleanTemporaryMessage: () => Promise<void>;
      try {
        const res = await getChecklistMessage(ctx, ctx.chat.id, location);
        checklistMessage = res.checklistMessage;
        cleanTemporaryMessage = res.cleanTemporaryMessage;
      } catch (error) {
        const prettyError =
          error instanceof TgError
            ? error.message
            : 'There was an error while getting the contents of the checklist';
        return await ctx.reply(prettyError);
      }

      // parse and update checklist
      const checklistData = extractCheckboxes(checklistMessage.text);
      const { lines } = checklistData;
      if (lines.length <= checkBoxIdx || !lines[checkBoxIdx].hasCheckBox) {
        await ctx.reply('Invalid checkbox idx');
        return await cleanTemporaryMessage();
      }

      lines[checkBoxIdx].isChecked = !lines[checkBoxIdx].isChecked;

      // send the new checklist
      const urlGenerator = checklistUrl(ctx, location);
      const checklistText = formatCheckBoxLines(checklistData, urlGenerator);
      await ctx.api.editMessageText(
        sourceChatId,
        sourceMessageId,
        checklistText
      );
      if (sourceChatId === ctx.chat.id && !inlineMessageId && !foreignChatId) {
        await ctx.deleteMessage();
      } else {
        await ctx.reply('✅ Done, press back to return to the chat', {
          disable_notification: true,
        });
      }

      // update the inline message if available
      if (inlineMessageId !== undefined) {
        await ctx.api.editMessageTextInline(inlineMessageId, checklistText);
      } else if (foreignChatId && foreignMessageId !== undefined) {
        await ctx.api.editMessageText(
          foreignChatId,
          foreignMessageId,
          checklistText
        );
      }

      return await cleanTemporaryMessage();
    }
  );
