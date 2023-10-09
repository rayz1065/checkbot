import { CheckBoxLine } from '../types/checklist';

export type ApiResult<T> =
  | {
      ok: true;
      description: undefined;
      result: T;
    }
  | {
      ok: false;
      description: string;
      result: undefined;
    };

/**
 * Makes an api POST request with the specified body
 * The suffix is placed after the base url, it should not start with '/'
 */
async function apiPost<T = unknown>(
  apiSuffix: string,
  body: Record<string, any>
): Promise<ApiResult<T>> {
  const result = await fetch(
    `https://${window.ENV.WEB_APP_API_URL}/${apiSuffix}`,
    {
      body: JSON.stringify(body),
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  try {
    const jsonValue = result.json();
    return jsonValue;
  } catch (error) {
    console.error('Result is not json', { result, error });
    return {
      ok: false,
      description: 'Communication error',
      result: undefined,
    };
  }
}

export function getChecklistMessage(data: {
  initData: string;
  location: string;
}) {
  return apiPost<CheckBoxLine[]>('message', data);
}

export function updateChecklistMessage(data: {
  initData: string;
  location: string;
  checklistLines: CheckBoxLine[];
}) {
  return apiPost('update-message', data);
}
