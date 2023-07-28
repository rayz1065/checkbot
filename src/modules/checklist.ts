import { Composer } from 'grammy';
import { MyContext } from '../main';
import { escapeHtml } from '../lib/utils';

interface CheckBox {
  isChecked: boolean;
  text: string;
}

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
  const resultingLines = [];
  const checkBoxes: CheckBox[] = [];

  for (const line of lines) {
    const checkedBox = isLineChecked(line);
    const uncheckedBox = isLineUnchecked(line);
    if (!checkedBox && !uncheckedBox) {
      resultingLines.push(line);
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
    const normalizedCheckBox = isChecked ? checkedBoxStyle : uncheckedBoxStyle;
    checkboxText = line.replace(
      new RegExp(`^${escapeRegExp(usedCheckBox)}\\s*`),
      ''
    );
    resultingLines.push(`${normalizedCheckBox} ${checkboxText}`);

    checkBoxes.push({
      isChecked: isChecked,
      text: checkboxText,
    });
  }

  const normalizedText = escapeHtml(resultingLines.join('\n'));
  return { hasCheckBoxes, normalizedText, checkBoxes };
}

checkListModule.on('message:text').filter(
  async (ctx) => {
    // Only handle this message if it has checkboxes
    const { hasCheckBoxes } = extractCheckboxes(ctx.message.text);
    return hasCheckBoxes;
  },
  async (ctx) => {
    const { normalizedText, checkBoxes } = extractCheckboxes(ctx.message.text);
    await ctx.reply(normalizedText);
  }
);
