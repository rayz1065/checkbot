import { Composer, GrammyError } from 'grammy';
import { MyContext } from '../main';
import { escapeHtml, ik } from '../lib/utils';
import { Message } from 'grammy/types';

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

export const checkListModule = new Composer<MyContext>();

const checkedBoxes = ['- [x]', '-[x]', '[x]', '✅', '☑️', '✔️'];
const uncheckedBoxes = ['- [ ]', '- []', '-[ ]', '-[]', '[]', '[ ]', '-'];

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

function isLineChecked(line: string) {
  for (const box of checkedBoxes) {
    if (line.startsWith(box)) {
      return box;
    }
  }
  return null;
}

function isLineUnchecked(line: string) {
  for (const box of uncheckedBoxes) {
    if (line.startsWith(box)) {
      return box;
    }
  }
  return null;
}

function extractCheckboxes(messageText: string) {
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
      checkedBoxStyle = checkedBoxStyle ?? checkedBox;
    } else {
      uncheckedBoxStyle = uncheckedBoxStyle ?? uncheckedBox;
    }

    const usedCheckBox = (isChecked ? checkedBox : uncheckedBox)!;
    checkboxText = line.replace(
      new RegExp(`^${escapeRegExp(usedCheckBox)}\\s*`),
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
  return { hasCheckBoxes, resultingLines, checkedBoxStyle, uncheckedBoxStyle };
}

function formatCheckBoxLines(
  lines: CheckBoxLine[],
  checkedBoxStyle: string,
  uncheckedBoxStyle: string,
  toggleUrl: (idx: number) => string
) {
  const resultingLines = lines.map((line, idx) => {
    if (!line.hasCheckBox) {
      return escapeHtml(line.text);
    }
    const checkBoxStyle = line.isChecked ? checkedBoxStyle : uncheckedBoxStyle;
    const itemText = line.isChecked
      ? `<s>${escapeHtml(line.text)}</s>`
      : escapeHtml(line.text);
    return `<a href="${toggleUrl(idx)}">${checkBoxStyle}</a> ${itemText}`;
  });
  return resultingLines.join('\n');
}

function formatCheckBoxLinesNoHtml(
  lines: CheckBoxLine[],
  checkedBoxStyle: string,
  uncheckedBoxStyle: string
) {
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

function checklistUrl(
  ctx: MyContext,
  checklistChatId: number,
  checklistMessageId: number
) {
  return (idx: number) =>
    `https://t.me/${ctx.me.username}?start=t_c_${checklistChatId}_${checklistMessageId}_${idx}`;
}

function checklistInlineUrl(
  ctx: MyContext,
  checklistChatId: number,
  checklistMessageId: number,
  inlineMessageId: string
) {
  return (idx: number) =>
    `https://t.me/${ctx.me.username}?start=t_i_${checklistChatId}_${checklistMessageId}_${idx}_${inlineMessageId}`;
}

async function sendChecklist(
  ctx: MyContext,
  lines: CheckBoxLine[],
  checkedBoxStyle: string,
  uncheckedBoxStyle: string
) {
  const normalizedText = formatCheckBoxLines(
    lines,
    checkedBoxStyle,
    uncheckedBoxStyle,
    () => '' // no URL is available yet
  );
  const checklistChatId = ctx.chat?.id ?? ctx.from?.id;
  if (!checklistChatId) {
    throw new Error('Failed to select a chat to send the message');
  }
  const checklistMessage = await ctx.api.sendMessage(
    checklistChatId,
    normalizedText
  );
  const checklistMessageId = checklistMessage.message_id;

  // edit the message now that the URL is available
  const urlGenerator = ctx.inlineMessageId
    ? checklistInlineUrl(
        ctx,
        checklistMessage.chat.id,
        checklistMessageId,
        ctx.inlineMessageId
      )
    : checklistUrl(ctx, checklistMessage.chat.id, checklistMessageId);
  const checklistText = formatCheckBoxLines(
    lines,
    checkedBoxStyle,
    uncheckedBoxStyle,
    urlGenerator
  );

  await ctx.api.editMessageText(
    checklistMessage.chat.id,
    checklistMessageId,
    checklistText
  );

  return { checklistChatId, checklistMessageId, checklistText };
}

// private messages with checkboxes
checkListModule
  .chatType('private')
  .on('message:text')
  .filter(
    // Only handle this message if it has checkboxes
    (ctx) => extractCheckboxes(ctx.message.text).hasCheckBoxes,
    async (ctx) => {
      if (ctx.message.via_bot?.id === ctx.me.id) {
        // this should have been responded to in 'chosen inline result'
        return;
      }
      const { resultingLines, checkedBoxStyle, uncheckedBoxStyle } =
        extractCheckboxes(ctx.message.text);

      await sendChecklist(
        ctx,
        resultingLines,
        checkedBoxStyle,
        uncheckedBoxStyle
      );
    }
  );

// 'check' command
checkListModule
  .chatType(['group', 'supergroup', 'private'])
  .command('check', async (ctx) => {
    const { resultingLines, checkedBoxStyle, uncheckedBoxStyle } =
      extractCheckboxes(ctx.match);

    await sendChecklist(
      ctx,
      resultingLines,
      checkedBoxStyle,
      uncheckedBoxStyle
    );
  });

// message containing #check in a group
checkListModule
  .chatType(['group', 'supergroup'])
  .on('message:text')
  .filter(
    // Only handle this message if it has a 'check' hashtag
    (ctx) => ctx.message.text.indexOf('#check') !== -1,
    async (ctx) => {
      const { resultingLines, checkedBoxStyle, uncheckedBoxStyle } =
        extractCheckboxes(ctx.message.text);

      await sendChecklist(
        ctx,
        resultingLines,
        checkedBoxStyle,
        uncheckedBoxStyle
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
  const { checkedBoxStyle, resultingLines, uncheckedBoxStyle } =
    getInlineQueryCheckBoxes(ctx.inlineQuery.query);

  return await ctx.answerInlineQuery(
    [
      {
        id: 'checklist',
        type: 'article',
        input_message_content: {
          message_text: formatCheckBoxLines(
            resultingLines,
            checkedBoxStyle,
            uncheckedBoxStyle,
            () => ''
          ),
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
        description: formatCheckBoxLinesNoHtml(
          resultingLines,
          checkedBoxStyle,
          uncheckedBoxStyle
        ),
      },
    ],
    {
      cache_time: -1,
      switch_pm_text: switchPmText,
      switch_pm_parameter: 'inline-too-long',
    }
  );
});

// deal with a chosen inline query
checkListModule.on('chosen_inline_result').filter(
  (ctx) => ctx.chosenInlineResult.result_id === 'checklist',
  async (ctx) => {
    const { checkedBoxStyle, resultingLines, uncheckedBoxStyle } =
      getInlineQueryCheckBoxes(ctx.chosenInlineResult.query);
    const inlineMessageId = ctx.chosenInlineResult.inline_message_id;
    if (!inlineMessageId) {
      return console.error('Failed to get inline message id', ctx);
    }

    // TODO handle if user has not started bot

    const { checklistText } = await sendChecklist(
      ctx,
      resultingLines,
      checkedBoxStyle,
      uncheckedBoxStyle
    );
    await ctx.api.editMessageTextInline(inlineMessageId, checklistText);
  }
);

// update a checklist
checkListModule
  .on('message')
  .command('start')
  .filter(
    (ctx) => ctx.match.startsWith('t_'),
    async (ctx) => {
      const splits = ctx.match.split('_');
      let checklistChatId = NaN;
      let checklistMessageId = NaN;
      let checkBoxIdx = NaN;
      let inlineMessageId: string | undefined = undefined;

      if (splits.length === 5 && splits[1] === 'c') {
        checklistChatId = parseInt(splits[2], 10);
        checklistMessageId = parseInt(splits[3], 10);
        checkBoxIdx = parseInt(splits[4], 10);
      } else if (splits.length === 6 && splits[1] === 'i') {
        checklistChatId = parseInt(splits[2], 10);
        checklistMessageId = parseInt(splits[3], 10);
        checkBoxIdx = parseInt(splits[4], 10);
        inlineMessageId = splits[5];
      }
      if (
        isNaN(checklistChatId) ||
        isNaN(checklistMessageId) ||
        isNaN(checkBoxIdx) ||
        (checklistChatId > 0 && checklistChatId !== ctx.from.id) ||
        checkBoxIdx < 0
      ) {
        return await ctx.reply('Error parsing command...');
      }

      if (checklistChatId !== ctx.from.id) {
        let chatMemberStatus: string;
        try {
          const chatMember = await ctx.api.getChatMember(
            checklistChatId,
            ctx.from.id
          );
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
          return await ctx.reply(
            `You do not have the rights to edit this checklist (maybe you're an anonymous admin, ` +
              `maybe the bot has no access to the members of the chat, make the bot administrator to fix this)`
          );
        }
      }

      // get contents of the checklist
      let checklistMessage: Message;
      try {
        // NOTE: this will NOT work if forwarding content is restricted.
        // There is probably no workaround for this, without storing checklists in the database.
        checklistMessage = await ctx.api.forwardMessage(
          ctx.chat.id,
          checklistChatId,
          checklistMessageId,
          { disable_notification: true }
        );
      } catch (error) {
        if (error instanceof GrammyError) {
          return await ctx.reply(
            `Failed to read checklist contents due to error: <code>${error.message}</code>`
          );
        }
        console.error('Failed to read checklist', error);
        return await ctx.reply(
          'Failed to read checklist contents due to unknown error'
        );
      }
      if (!checklistMessage.text) {
        return await ctx.reply('Failed to read checklist contents');
      }

      const cleanTemporaryMessage = async () => {
        return await ctx.api.deleteMessage(
          checklistMessage.chat.id,
          checklistMessage.message_id
        );
      };

      // parse and update checklist
      const { checkedBoxStyle, resultingLines, uncheckedBoxStyle } =
        extractCheckboxes(checklistMessage.text);
      if (
        resultingLines.length <= checkBoxIdx ||
        !resultingLines[checkBoxIdx].hasCheckBox
      ) {
        await ctx.reply('Invalid checkbox idx');
        return await cleanTemporaryMessage();
      }

      resultingLines[checkBoxIdx].isChecked =
        !resultingLines[checkBoxIdx].isChecked;

      // send the new checklist
      const urlGenerator = inlineMessageId
        ? checklistInlineUrl(
            ctx,
            checklistMessage.chat.id,
            checklistMessageId,
            inlineMessageId
          )
        : checklistUrl(ctx, checklistMessage.chat.id, checklistMessageId);
      const checklistText = formatCheckBoxLines(
        resultingLines,
        checkedBoxStyle,
        uncheckedBoxStyle,
        urlGenerator
      );
      await ctx.api.editMessageText(
        checklistChatId,
        checklistMessageId,
        checklistText
      );
      if (checklistChatId === ctx.chat.id && !inlineMessageId) {
        await ctx.deleteMessage();
      } else {
        await ctx.reply('✅ Done, press back to return to the chat', {
          disable_notification: true,
        });
      }

      // update the inline message if available
      if (inlineMessageId !== undefined) {
        await ctx.api.editMessageTextInline(inlineMessageId, checklistText);
      }

      return await cleanTemporaryMessage();
    }
  );
