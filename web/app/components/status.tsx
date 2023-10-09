import { Loader, Text } from '@mantine/core';

export interface StatusData {
  code: 'ok' | 'error' | 'loading';
  text: string;
}

interface Props {
  status: StatusData;
}

export default function Status({ status }: Props) {
  return (
    <Text c="var(--tg-theme-hint-color)" size="sm" pt={2}>
      {
        {
          ok: 'ℹ️',
          error: '⚠️',
          loading: '✍️',
        }[status.code]
      }{' '}
      Status: <b>{status.text}</b>{' '}
      {status.code === 'loading' && <Loader size={6} />}
    </Text>
  );
}
