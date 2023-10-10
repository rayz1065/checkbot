import { Card, Container, Loader, ScrollArea } from '@mantine/core';
import {
  json,
  TypedResponse,
  type MetaFunction,
  LoaderFunctionArgs,
} from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { MainButton, useShowPopup } from '@vkruglikov/react-telegram-web-app';
import { useEffect, useState } from 'react';
import { ApiResult, createChecklistMessage } from '../services/api';
import Checklist from '../components/checklist';
import Status, { StatusData } from '../components/status';
import { CheckBoxLine } from '../services/checklist-extractor';

export const meta: MetaFunction = () => {
  return [
    { title: 'Create Checklist' },
    { name: 'description', content: 'Create Telegram Checklist' },
  ];
};

export function loader({ request }: LoaderFunctionArgs): TypedResponse<
  ApiResult<{
    location: string;
    list: { lines: any[] };
  }>
> {
  const params = new URL(request.url).searchParams;
  let result: any;
  try {
    result = JSON.parse(
      Buffer.from(
        params.get('tgWebAppStartParam') ?? '',
        'base64url'
      ).toString()
    );
    if (!result.location || !result.list?.lines) {
      throw new Error();
    }
  } catch (error) {
    return json({
      ok: false,
      result: undefined,
      description: 'Invalid data',
    });
  }

  return json({
    ok: true,
    result: result,
    description: undefined,
  });
}

export default function Index() {
  // TODO: localize
  const [webApp, setWebApp] = useState<WebApp | null>(null);
  const loaderResult = useLoaderData<typeof loader>();
  const [status, setStatus] = useState<StatusData>({
    code: 'ok',
    text: 'idle',
  });
  const [failedContacting, setFailedContacting] = useState(false);
  const [checklistLines, setChecklistLines] = useState<CheckBoxLine[]>([]);
  const showPopup = useShowPopup();

  async function createChecklist(
    webApp: WebApp,
    location: string,
    checklistLines: CheckBoxLine[]
  ) {
    // create the checklist on telegram through the api
    setStatus({
      code: 'loading',
      text: 'The checklist is being created',
    });

    const { ok, description } = await createChecklistMessage({
      initData: webApp.initData,
      location,
      checklistLines,
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
      text: 'Checklist created, you may close this now',
    });

    await showPopup({ message: 'Checklist created!' });
    webApp.close();
  }

  function requestWriteAccessAndCreateChecklist(webApp: WebApp) {
    setFailedContacting(false);
    if (!loaderResult.ok) {
      return setStatus({
        code: 'error',
        text: loaderResult.description,
      });
    }
    const {
      result: {
        list: { lines: checklistLines },
        location,
      },
    } = loaderResult;
    setChecklistLines(checklistLines);

    webApp.requestWriteAccess((success) => {
      if (success) {
        createChecklist(webApp, location, checklistLines);
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
      requestWriteAccessAndCreateChecklist(webApp);
    }
  });

  // the webapp must be loaded from the client side
  if (!webApp) {
    return <Loader mt="md" ml="md"></Loader>;
  }

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
          />
        </ScrollArea>
        <Status status={status} />
      </Card>
      {failedContacting && (
        <MainButton
          text="Allow contacting"
          onClick={() => requestWriteAccessAndCreateChecklist(webApp)}
        />
      )}
    </Container>
  );
}
