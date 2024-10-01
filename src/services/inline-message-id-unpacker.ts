import { TLReader, TLWriter, is } from '@mtkruto/node';
import {
  base64DecodeUrlSafe,
  base64EncodeUrlSafe,
} from '@mtkruto/node/1_utilities';

interface InputBotInlineMessageID {
  _: 'inputBotInlineMessageID';
  dc_id: number;
  id: bigint;
  access_hash: bigint;
}

interface InputBotInlineMessageID64 {
  _: 'inputBotInlineMessageID64';
  dc_id: number;
  owner_id: bigint;
  id: number;
  access_hash: bigint;
}

const inputBotInlineMessageID: [number, string[][]] = [
  0x890c3d89,
  [
    ['dc_id', 'number', 'int'],
    ['id', 'bigint', 'long'],
    ['access_hash', 'bigint', 'long'],
  ],
];
const inputBotInlineMessageID64: [number, string[][]] = [
  0xb6d915d7,
  [
    ['dc_id', 'number', 'int'],
    ['owner_id', 'bigint', 'long'],
    ['id', 'number', 'int'],
    ['access_hash', 'bigint', 'long'],
  ],
];

type UnpackedData = InputBotInlineMessageID | InputBotInlineMessageID64;

export function unpackInlineMessageId(id: string): UnpackedData | false {
  try {
    const buffer = base64DecodeUrlSafe(id);
    const reader = new TLReader(buffer);

    const cid =
      buffer.byteLength == 20
        ? inputBotInlineMessageID
        : inputBotInlineMessageID64;

    const object = reader.readObject(cid[0]);
    if (
      is('inputBotInlineMessageID64', object) ||
      is('inputBotInlineMessageID', object)
    ) {
      return object;
    }
  } catch {}

  return false;
}

export function packInlineMessageId(data: UnpackedData) {
  const writer = new TLWriter();
  writer.writeObject(data);
  return base64EncodeUrlSafe(writer.buffer.slice(4));
}
