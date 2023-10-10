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

export interface ChecklistData {
  hasCheckBoxes: boolean;
  lines: CheckBoxLine[];
  checkedBoxStyle: string;
  uncheckedBoxStyle: string;
}

export interface ChecklistExtractorConfig {
  default_checked_box: string;
  default_unchecked_box: string;
}

export const suggestedCheckedBoxes = ['✅', '☑️', '✔️'];
export const suggestedUncheckedBoxes = ['- [ ]', '- [  ]', '- [   ]'];
export const checkedBoxes = [...suggestedCheckedBoxes, '- [x]', '☑', '✔'];

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * test if a line starts with a checked box
 * returns the corresponding box and a normalized version
 */
export function isLineChecked(line: string) {
  // - [x] with any amount of spaces before and within the box
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

/**
 * test if a line starts with an unchecked box
 * returns the corresponding box and a normalized version
 */
export function isLineUnchecked(line: string) {
  // - [] with any amount of spaces before and within the box
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

/**
 * Extracts the checkboxes from the list
 */
function _extractCheckboxes(messageText: string) {
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

/**
 * Extracts the checkboxes from a list and applies the passed config to it
 */
export function extractCheckboxes(
  messageText: string,
  config?: ChecklistExtractorConfig | null
): ChecklistData {
  let { checkedBoxStyle, uncheckedBoxStyle, ...etc } =
    _extractCheckboxes(messageText);
  config ??= {
    default_checked_box: suggestedCheckedBoxes[0],
    default_unchecked_box: suggestedUncheckedBoxes[0],
  };
  checkedBoxStyle ??= config.default_checked_box;
  uncheckedBoxStyle ??= config.default_unchecked_box;

  return { ...etc, checkedBoxStyle, uncheckedBoxStyle };
}

/**
 * Parses a checklist contained in an inline query
 * Accepts a simpler format where items are separated by commas and dots
 * But only if the checklist is written on a single line
 */
export function getInlineQueryCheckBoxes(
  query: string,
  config?: ChecklistExtractorConfig | null
) {
  // replaces lines which are not checkboxes with an unchecked line
  let lines = query.split('\n');
  if (lines.length === 1) {
    // if there is only one line, tries to split on commas and dots
    lines = query.split(/[.,]/g);
  }

  const items = lines
    .filter((x) => x.length > 0)
    .map((x) => (isLineChecked(x) || isLineUnchecked(x) ? x : `- [ ] ${x}`));

  return extractCheckboxes(items.join('\n'), config);
}
