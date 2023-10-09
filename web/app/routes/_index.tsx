import {
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Loader,
  ScrollArea,
  SimpleGrid,
  Text,
} from '@mantine/core';
import type { MetaFunction } from '@remix-run/node';
import { useSearchParams } from '@remix-run/react';
import { useEffect, useState } from 'react';

export const meta: MetaFunction = () => {
  return [
    { title: 'CheckliBot app' },
    { name: 'description', content: 'Create checklists on telegram' },
  ];
};

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

export default function Index() {
  // TODO: localize
  const [webApp, setWebApp] = useState<WebApp | null>(null);
  const [params] = useSearchParams();
  const location = params.get('tgWebAppStartParam') ?? '';
  const [checkListLines, setCheckListLines] = useState<CheckBoxLine[]>(
    () => JSON.parse(params.get('list') ?? '{"lines":[]}').lines
  );
  const [status, setStatus] = useState<{
    code: 'ok' | 'error' | 'loading';
    text: string;
  }>({
    code: 'ok',
    text: 'idle',
  });

  useEffect(() => {
    const fetchMessage = async (initData: string) => {
      // loads the checklist from telegram through the api
      const res = await fetch(`https://${window.ENV.WEB_APP_API_URL}/message`, {
        body: JSON.stringify({
          initData,
          location,
        }),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const { ok, result, description } = await res.json();
      if (!ok) {
        setStatus({
          code: 'error',
          text: description,
        });
        return;
      }
      setCheckListLines(result);
    };

    if (webApp === null && window.Telegram.WebApp) {
      setWebApp(window.Telegram.WebApp);
      if (checkListLines.length === 0) {
        // lines were not passed from the url, they must be fetched from the api
        fetchMessage(window.Telegram.WebApp.initData);
      }
    }
  });

  async function updateCheckListLines(newLines: CheckBoxLine[]) {
    setCheckListLines(newLines);

    setStatus({
      code: 'loading',
      text: 'saving checklist',
    });

    // updates the checklist message to store the data on telegram
    const res = await fetch('https://check.rayzdev.me/api/update-message', {
      body: JSON.stringify({
        initData: webApp?.initData,
        location,
        checklistLines: newLines,
      }),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const { ok, description } = await res.json();
    if (!ok) {
      setStatus({
        code: 'error',
        text: description,
      });
      return;
    }

    setStatus({
      code: 'ok',
      text: 'saved',
    });
  }

  // the webapp must be loaded from the client side
  if (!webApp) {
    return <Loader mt="md" ml="md"></Loader>;
  }

  /**
   * Renders either a line containing a checkbox or a simple text line
   **/
  function renderLine(line: CheckBoxLine, idx: number) {
    return (
      <Box pb="2px" key={idx}>
        {line.hasCheckBox ? (
          <Checkbox
            c="var(--tg-theme-button-color)"
            checked={line.isChecked}
            key={idx}
            onChange={() => {
              updateCheckListLines(
                checkListLines.map((otherLine, otherIdx) =>
                  otherIdx === idx
                    ? {
                        ...line,
                        isChecked: !line.isChecked,
                        hasCheckBox: true,
                      }
                    : otherLine
                )
              );
            }}
            label={<Text c="var(--tg-theme-text-color)">{line.text}</Text>}
          ></Checkbox>
        ) : (
          <Text size="lg" c="var(--tg-theme-text-color)">
            {line.text}
          </Text>
        )}
      </Box>
    );
  }

  const checkedBoxes = checkListLines.filter(
    (x) => x.hasCheckBox && x.isChecked
  );
  const uncheckedBoxes = checkListLines.filter(
    (x) => x.hasCheckBox && !x.isChecked
  );

  return (
    <Container pt="sm" pb="sm" h="var(--tg-viewport-stable-height)">
      <Card
        bg="var(--tg-theme-bg-color)"
        c="var(--tg-theme-text-color)"
        h="100%"
      >
        <ScrollArea h="var(--tg-viewport-stable-height)">
          {checkListLines.map(renderLine)}
        </ScrollArea>
        <SimpleGrid cols={2} mt="md">
          <Button
            c="var(--tg-theme-button-color)"
            disabled={uncheckedBoxes.length === 0}
            leftSection="✅"
            onClick={() => {
              updateCheckListLines(
                checkListLines.map((line) =>
                  line.hasCheckBox ? { ...line, isChecked: true } : line
                )
              );
            }}
          >
            <Text c="var(--tg-theme-text-color)">Check all</Text>
          </Button>
          <Button
            c="var(--tg-theme-button-color)"
            disabled={checkedBoxes.length === 0}
            leftSection="❌"
            onClick={() => {
              updateCheckListLines(
                checkListLines.map((line) =>
                  line.hasCheckBox ? { ...line, isChecked: false } : line
                )
              );
            }}
          >
            <Text c="var(--tg-theme-text-color)">Clear checks</Text>
          </Button>
        </SimpleGrid>
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
      </Card>
    </Container>
  );
}
