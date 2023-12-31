import {
  Box,
  Button,
  Card,
  Container,
  FocusTrap,
  Loader,
  ScrollArea,
  SimpleGrid,
  Text,
} from '@mantine/core';
import type { MetaFunction } from '@remix-run/node';
import { useSearchParams } from '@remix-run/react';
import { MainButton } from '@vkruglikov/react-telegram-web-app';
import { useEffect, useState } from 'react';
import {
  CheckBoxLine,
  extractCheckboxes,
} from '../services/checklist-extractor';
import { getChecklistMessage, updateChecklistMessage } from '../services/api';
import Checklist from '../components/checklist';
import Status, { StatusData } from '../components/status';
import { useDebouncedValue } from '@mantine/hooks';

export const meta: MetaFunction = () => {
  return [
    { title: 'Edit Checklist' },
    { name: 'description', content: 'Edit Telegram Checklist' },
  ];
};

/**
 * Simplified version of a checklist formatter
 */
export function formatCheckBoxLines(lines: CheckBoxLine[]) {
  const resultingLines = lines.map((line) => {
    if (!line.hasCheckBox) {
      return line.text;
    }
    const checkBoxStyle = line.isChecked ? '- [x]' : '- [ ]';
    return `${checkBoxStyle} ${line.text}`;
  });

  return resultingLines.join('\n');
}

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
  const [contactStatus, setContactStatus] = useState<
    'ok' | 'error' | 'loading'
  >('ok');
  const [editAsText, setEditAsText] = useState(false);
  const [checklistTextValue, setChecklistTextValue] = useState(
    formatCheckBoxLines(checklistLines)
  );
  const [debouncedChecklistTextValue, cancelTextUpdate] = useDebouncedValue(
    checklistTextValue,
    1000
  );

  async function fetchMessage(webApp: WebApp) {
    // loads the checklist from telegram through the api
    setStatus({
      code: 'loading',
      text: 'The checklist is being loaded',
    });

    const { ok, result, description } = await getChecklistMessage({
      initData: webApp.initData,
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
    setChecklistTextValue(formatCheckBoxLines(result));
    cancelTextUpdate();
    webApp.CloudStorage.getItem('edit-mode', (error, value) => {
      setEditAsText(value === 'text');
    });
  }

  function requestWriteAccessAndFetchMessage(webApp: WebApp) {
    if (!webApp.initDataUnsafe.user?.allows_write_to_pm) {
      setContactStatus('loading');
    }
    webApp.requestWriteAccess((success) => {
      if (success) {
        setContactStatus('ok');
        fetchMessage(webApp);
      } else {
        setContactStatus('error');
        setStatus({
          code: 'error',
          text: 'The bot requires to contact you to work',
        });
      }
    });
  }

  /**
   * Initial webapp load
   */
  useEffect(() => {
    if (webApp === null && window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      setWebApp(webApp);
      if (checklistLines.length === 0) {
        // lines were not passed from the url, they must be fetched from the api
        requestWriteAccessAndFetchMessage(webApp);
      } else {
        webApp.CloudStorage.getItem('edit-mode', (error, value) => {
          setEditAsText(value === 'text');
        });
      }
    }
  });

  /**
   * Edit as text mode requires custom logic for saving the checklist
   */
  useEffect(() => {
    if (!editAsText) {
      webApp?.disableClosingConfirmation();
      return;
    }

    if (checklistTextValue !== debouncedChecklistTextValue) {
      webApp?.enableClosingConfirmation();
      setStatus({
        code: 'loading',
        text: 'Waiting for you to finish typing',
      });
    } else {
      // once the value is debounced, store it
      const checklist = extractCheckboxes(checklistTextValue);
      updateChecklistLines(checklist.lines);
      webApp?.disableClosingConfirmation();
    }
  }, [checklistTextValue, debouncedChecklistTextValue, editAsText]);

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

  function getMainButton() {
    if (contactStatus === 'loading') {
      return <></>;
    }

    if (contactStatus === 'error') {
      return (
        <MainButton
          text="Allow contacting"
          onClick={() => requestWriteAccessAndFetchMessage(webApp!)}
        />
      );
    }

    return (
      <MainButton
        text={editAsText ? 'Edit as list 📄' : 'Edit as text 📝'}
        onClick={() => {
          if (editAsText) {
            const checklist = extractCheckboxes(checklistTextValue);
            updateChecklistLines(checklist.lines);
            setEditAsText(false);
            webApp?.CloudStorage.setItem('edit-mode', 'list');
          } else {
            setChecklistTextValue(formatCheckBoxLines(checklistLines));
            cancelTextUpdate();
            setEditAsText(true);
            webApp?.CloudStorage.setItem('edit-mode', 'text');
          }
        }}
      />
    );
  }

  function markAllAs(checked: boolean) {
    const usedLines = editAsText
      ? extractCheckboxes(checklistTextValue).lines
      : checklistLines;

    const newLines = usedLines.map((line) =>
      line.hasCheckBox ? { ...line, isChecked: checked } : line
    );

    updateChecklistLines(newLines);
    if (editAsText) {
      setChecklistTextValue(formatCheckBoxLines(newLines));
      cancelTextUpdate();
    }
  }

  return (
    <Container pt="sm" pb="sm" h="var(--tg-viewport-stable-height)">
      <Card
        bg="var(--tg-theme-bg-color)"
        c="var(--tg-theme-text-color)"
        h="100%"
      >
        {editAsText ? (
          <Box h="100%" pb="sm">
            <FocusTrap>
              <textarea
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  minWidth: '100%',
                }}
                placeholder="Type your items here..."
                value={checklistTextValue}
                onChange={(change) =>
                  setChecklistTextValue(change.target.value)
                }
              />
            </FocusTrap>
          </Box>
        ) : (
          <ScrollArea h="var(--tg-viewport-stable-height)">
            <Checklist
              showLoading={
                checklistLines.length === 0 && status.code === 'loading'
              }
              checklistLines={checklistLines}
              updateChecklistLines={updateChecklistLines}
            />
          </ScrollArea>
        )}
        <SimpleGrid cols={2} mt="md">
          <Button
            c="var(--tg-theme-button-color)"
            disabled={uncheckedBoxes.length === 0}
            leftSection="✅"
            onClick={() => markAllAs(true)}
          >
            <Text c="var(--tg-theme-text-color)">Check all</Text>
          </Button>
          <Button
            c="var(--tg-theme-button-color)"
            disabled={checkedBoxes.length === 0}
            leftSection="❌"
            onClick={() => markAllAs(false)}
          >
            <Text c="var(--tg-theme-text-color)">Clear checks</Text>
          </Button>
        </SimpleGrid>
        <Status status={status} />
      </Card>
      {getMainButton()}
    </Container>
  );
}
