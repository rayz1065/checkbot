import { User } from 'grammy/types';

/**
 * Uses dash (-) as an escape character and underscore (_) as a separator
 */
export function encodeDeepLinkParams(params: (string | number)[]) {
  const strParams = params.map((x) => `${x}`);

  const failedParam = strParams.find((x) => !/^[a-zA-Z0-9_-]+$/.test(x));
  if (failedParam !== undefined) {
    throw new Error(
      `Encoded params contain invalid characters, ${failedParam} found`
    );
  }

  const escapedParams = strParams.map((x) =>
    x.replace(/-/g, '--').replace(/_/g, '-_')
  );
  return escapedParams.join('_');
}

/**
 * Decodes the encoded parameters and returns them as an array
 */
export function decodeDeepLinkParams(encodedParams: string) {
  const splits = encodedParams
    .replace(/--/g, '$')
    .replace(/-_/g, '!')
    .split('_');
  return splits.map((x) => x.replace(/\$/g, '-').replace(/!/g, '_'));
}

/**
 * Creates a deep-link url with the given start parameter
 */
export function deepLinkUrl(me: User, startParam: string) {
  return `https://t.me/${me.username}?start=${startParam}`;
}

/**
 * Creates a deep-link url with encoded params
 */
export function encodeDeepLinkUrl(me: User, params: (string | number)[]) {
  return deepLinkUrl(me, encodeDeepLinkParams(params));
}

/**
 * Creates a start-app url with the given start parameter
 */
export function startAppUrl(me: User, appName: string, startParam: string) {
  return `https://t.me/${me.username}/${appName}?startapp=${startParam}`;
}

/**
 * Creates a start-app url with the encoded params
 */
export function encodeStartAppUrl(
  me: User,
  appName: string,
  params: (string | number)[]
) {
  return startAppUrl(me, appName, encodeDeepLinkParams(params));
}
