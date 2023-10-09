import {
  Button,
  Card,
  Container,
  Loader,
  ScrollArea,
  SimpleGrid,
  Text,
} from '@mantine/core';
import type { MetaFunction } from '@remix-run/node';
import { useSearchParams } from '@remix-run/react';
import { MainButton } from '@vkruglikov/react-telegram-web-app';
import { useEffect, useState } from 'react';
import { CheckBoxLine } from '../types/checklist';
import { getChecklistMessage, updateChecklistMessage } from '../services/api';
import Checklist from '../components/checklist';
import Status, { StatusData } from '../components/status';

export const meta: MetaFunction = () => {
  return [
    { title: 'Edit Checklist' },
    { name: 'description', content: 'Edit Telegram Checklist' },
  ];
};

export default function Index() {
  // TODO: localize
  const [webApp, setWebApp] = useState<WebApp | null>(null);
  const [params] = useSearchParams();
  const location = params.get('tgWebAppStartParam') ?? '';
  const [checklistLines, setChecklistLines] = useState<CheckBoxLine[]>(
    () => JSON.parse(params.get('list') ?? '{"lines":[]}').lines
  );
  const [status, setStatus] = useState<StatusData>({
    code: 'ok',
    text: 'idle',
  });
  const [failedContacting, setFailedContacting] = useState(false);

  async function fetchMessage(initData: string) {
    // loads the checklist from telegram through the api
    setStatus({
      code: 'loading',
      text: 'The checklist is being loaded',
    });

    const { ok, result, description } = await getChecklistMessage({
      initData,
      location,
    });
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
    setChecklistLines(result);
  }

  function requestWriteAccessAndFetchMessage(webApp: WebApp) {
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
      if (checklistLines.length === 0) {
        // lines were not passed from the url, they must be fetched from the api
        requestWriteAccessAndFetchMessage(webApp);
      }
    }
  });

  async function updateChecklistLines(newLines: CheckBoxLine[]) {
    setChecklistLines(newLines);

    setStatus({
      code: 'loading',
      text: 'saving checklist',
    });

    // updates the checklist message to store the data on telegram
    const { ok, description } = await updateChecklistMessage({
      initData: webApp?.initData ?? '',
      location,
      checklistLines: newLines,
    });
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

  const checkedBoxes = checklistLines.filter(
    (x) => x.hasCheckBox && x.isChecked
  );
  const uncheckedBoxes = checklistLines.filter(
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
          <Checklist
            showLoading={
              checklistLines.length === 0 && status.code === 'loading'
            }
            checklistLines={checklistLines}
            updateChecklistLines={updateChecklistLines}
          />
        </ScrollArea>
        <SimpleGrid cols={2} mt="md">
          <Button
            c="var(--tg-theme-button-color)"
            disabled={uncheckedBoxes.length === 0}
            leftSection="✅"
            onClick={() => {
              updateChecklistLines(
                checklistLines.map((line) =>
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
              updateChecklistLines(
                checklistLines.map((line) =>
                  line.hasCheckBox ? { ...line, isChecked: false } : line
                )
              );
            }}
          >
            <Text c="var(--tg-theme-text-color)">Clear checks</Text>
          </Button>
        </SimpleGrid>
        <Status status={status} />
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
