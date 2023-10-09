import {
  Box,
  Button,
  Card,
  Checkbox,
  Container,
  Loader,
  ScrollArea,
  SimpleGrid,
  Skeleton,
  Text,
} from '@mantine/core';
import type { MetaFunction } from '@remix-run/node';
import { useSearchParams } from '@remix-run/react';
import { MainButton } from '@vkruglikov/react-telegram-web-app';
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
  const [failedContacting, setFailedContacting] = useState(false);

  const fetchMessage = async (initData: string) => {
    // loads the checklist from telegram through the api
    setStatus({
      code: 'loading',
      text: 'The checklist is being loaded',
    });

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

    setStatus({
      code: 'ok',
      text: 'Checklist loaded',
    });
    setCheckListLines(result);
  };

  function requestWriteAccessAndFetchMessage(webApp: WebApp) {
    if (!webApp) return;
    setFailedContacting(false);
    webApp.requestWriteAccess((success) => {
      if (success) {
        fetchMessage(webApp.initData);
      } else {
        setFailedContacting(true);
        setStatus({
          code: 'error',
          text: 'The bot requires to contact you to work',
        });
      }
    });
  }

  useEffect(() => {
    if (webApp === null && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      setWebApp(webApp);
      if (checkListLines.length === 0) {
        // lines were not passed from the url, they must be fetched from the api
        requestWriteAccessAndFetchMessage(webApp);
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
          {checkListLines.length === 0 && status.code === 'loading' ? (
            <>
              <Skeleton height={20} radius="lg" />
              <Skeleton height={20} mt={10} radius="lg" />
              <Skeleton height={20} mt={10} width="70%" radius="lg" />
            </>
          ) : (
            checkListLines.map(renderLine)
          )}
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
      {failedContacting && (
        <MainButton
          text="Allow contacting"
          onClick={() => requestWriteAccessAndFetchMessage(webApp)}
        />
      )}
    </Container>
  );
}
