import assert from 'assert';
import base from 'base-x';
import crypto from 'crypto';
import { Message, UserFromGetMe } from 'grammy/types';
import {
  encodeDeepLinkParams,
  encodeDeepLinkUrl,
  encodeStartAppUrl,
} from '../lib/deep-linking';
import { Api, GrammyError, InlineKeyboard } from 'grammy';
import { ChecklistData } from './checklist-extractor';
import { TgError, escapeHtml, ik } from '../lib/utils';
import {
  packInlineMessageId,
  unpackInlineMessageId,
} from './inline-message-id-unpacker';
import { base62DecodeNumber, base62EncodeNumber } from '../lib/base-62-numbers';

const base62 = base(
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
);

/**
 * Identifies the location(s) where a checklist is stored
 * The <sourceChatId, sourceMessageId> is always accessible for forwards
 * while inline messages and foreign chats are not
 */
export interface ChecklistMessageLocation {
  sourceChatId: number;
  sourceMessageId: number;
  salt: string;
  foreignChatId?: number;
  foreignMessageId?: number;
  inlineMessageId?: string;
  isPersonal?: boolean;
}

export type UnsentChecklistLocation = Omit<
  ChecklistMessageLocation,
  'sourceMessageId'
>;

/**
 * Encoded location to be stored in deep link
 */
export type LocationIdentifier =
  | [
      // inline message cannot be read by the bot
      't',
      'i' | 'j',
      sourceChatId: string,
      sourceMessageId: string,
      inlineMessageId: string,
      signature: string
    ]
  | [
      // inline message from a user with a 64-bit id
      't',
      'I' | 'J',
      sourceChatId: string,
      sourceMessageId: string,
      dcId: string,
      id: string,
      accessHash: string,
      signature: string
    ]
  | [
      // the message is sent in a chat where forwards are blocked
      't',
      'f',
      sourceChatId: string,
      sourceMessageId: string,
      foreignChatId: string,
      foreignMessageId: string,
      signature: string
    ]
  | [
      // pm
      't',
      'c',
      sourceChatId: string,
      sourceMessageId: string,
      signature: string
    ];

export type LocationIdentifierAndIndex = [
  ...LocationIdentifier,
  lineIdx: string
];

/**
 * A signature is computed for a location to ensure the
 */
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

  // base62 is used since it's more compact
  // within 12 characters we store ~70 bits of information
  // we don't use base64 since it becomes wasteful when
  // encoding it as a deep-link param
  const hashedLocation = base62.encode(hashResult);

  return `${location.salt}${hashedLocation.substring(0, 12)}`;
}

/**
 * The location is transformed into a locationIdentifier, this is a format
 * that is more easily encoded with few bytes and can therefore be used
 * within a deep link
 */
export function getLocationIdentifier(
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
    const unpacked = unpackInlineMessageId(inlineMessageId);
    if (unpacked && 'owner_id' in unpacked) {
      return [
        't',
        isPersonal ? 'J' : 'I',
        sourceChatId.toString(36),
        sourceMessageId.toString(36),
        unpacked.dc_id.toString(36),
        unpacked.id.toString(36),
        base62EncodeNumber(unpacked.access_hash),
        computeLocationSignature(location),
      ];
    }
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

/**
 * The reverse step as `getLocationIdentifier`, generates a more usable format
 *
 * @throws Error If the format is invalid or the signature does not match the data
 */
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
  } else if (splits.length >= 7 && ['I', 'J'].indexOf(splits[1]) !== -1) {
    location.isPersonal = splits[1] === 'J';
    location.sourceChatId = parseInt(splits[2], 36);
    location.sourceMessageId = parseInt(splits[3], 36);
    const dcId = parseInt(splits[4], 36);
    const id = parseInt(splits[5], 36);
    const ownerId = BigInt(location.sourceChatId);
    const accessHash = base62DecodeNumber(splits[6]);

    if (isNaN(dcId) || isNaN(id)) {
      throw new TypeError('Failed to parse command');
    }
    location.inlineMessageId = packInlineMessageId({
      _: 'inputBotInlineMessageID64',
      access_hash: accessHash,
      dc_id: dcId,
      id,
      owner_id: ownerId,
    });
    signature = splits[7];
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
 * Formats the checkboxes for a message
 */
export function formatCheckBoxLines(
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

/**
 * Formats the checkboxes to plain text, useful for inline message previews,...
 */
export function formatCheckBoxLinesNoHtml(checklistData: ChecklistData) {
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

/**
 * Sends the checklist to the specified chat, then updates it once
 * the message id is available
 */
export async function sendChecklist(
  api: Api,
  me: UserFromGetMe,
  location: UnsentChecklistLocation,
  checklistData: ChecklistData
) {
  const normalizedText = formatCheckBoxLines(
    checklistData,
    () => '' // no URL is available yet
  );
  const { sourceChatId, foreignChatId } = location;
  const checklistMessage = await api.sendMessage(sourceChatId, normalizedText, {
    disable_web_page_preview: true,
  });
  const sourceMessageId = checklistMessage.message_id;
  const completeLocation: ChecklistMessageLocation = {
    ...location,
    sourceMessageId,
  };

  if (foreignChatId) {
    // get a foreignMessageId
    const foreignChecklistMessage = await api.sendMessage(
      foreignChatId,
      normalizedText,
      { disable_web_page_preview: true }
    );
    completeLocation.foreignMessageId = foreignChecklistMessage.message_id;
  }

  // edit the message now that the URL is available
  await updateChecklistMessage(api, me, completeLocation, checklistData);

  return { completeLocation, checklistData };
}

/**
 * Updates the checklist message with URLs to toggle the boxes
 */
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
  const locationIdentifier = getLocationIdentifier(location);
  const urlGenerator = (idx: number) =>
    encodeDeepLinkUrl(me, [...locationIdentifier, idx.toString(36)]);
  const checklistText = formatCheckBoxLines(checklistData, urlGenerator);

  const startAppUrlButton = InlineKeyboard.url(
    '✏️',
    encodeStartAppUrl(me, 'edit_checklist', getLocationIdentifier(location))
  );
  const webappButton = InlineKeyboard.webApp(
    '✏️',
    `https://${
      process.env.WEB_APP_URL
    }/?tgWebAppStartParam=${encodeDeepLinkParams(
      getLocationIdentifier(location)
    )}&list=${encodeURIComponent(JSON.stringify(checklistData))}`
  );

  api
    .editMessageText(sourceChatId, sourceMessageId, checklistText, {
      disable_web_page_preview: true,
      parse_mode: 'HTML',
      ...ik([
        [
          // webapp buttons are not available in groups/channels
          sourceChatId > 0 ? webappButton : startAppUrlButton,
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
        ...ik([[startAppUrlButton]]),
      })
      .catch(() => {
        // May fail if the message has been deleted
      });
  } else if (foreignChatId && foreignMessageId !== undefined) {
    api
      .editMessageText(foreignChatId, foreignMessageId, checklistText, {
        disable_web_page_preview: true,
        parse_mode: 'HTML',
        ...ik([[startAppUrlButton]]),
      })
      .catch(() => {
        // May fail if the message has been deleted
      });
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
