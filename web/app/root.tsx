import { cssBundleHref } from '@remix-run/css-bundle';
import type { LinksFunction } from '@remix-run/node';
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@remix-run/react';
import {
  MantineProvider,
  ColorSchemeScript,
  MantineColorsTuple,
} from '@mantine/core';
import '@mantine/core/styles.css';
import styles from '~/styles/global.css';
import { generateColors } from '@mantine/colors-generator';
import { useEffect, useState } from 'react';
import { ColorScheme } from '@vkruglikov/react-telegram-web-app';

export const links: LinksFunction = () => [
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
  { rel: 'stylesheet', href: styles },
];

export default function App() {
  const [extraColors, setExtraColors] = useState<
    Record<string, MantineColorsTuple>
  >({
    primary: generateColors('#228be6'),
  });
  const [colorScheme, setColorScheme] = useState<ColorScheme | undefined>();

  /**
   * Create a custom color scheme based on the user's theme
   */
  useEffect(() => {
    if (window.Telegram.WebApp) {
      const webApp = window.Telegram.WebApp;
      if (webApp.colorScheme === colorScheme) {
        return;
      }
      setExtraColors({
        primary: generateColors(webApp.themeParams.button_color),
      });
      setColorScheme(webApp.colorScheme);
    }
  }, [
    typeof window !== 'undefined'
      ? window.Telegram?.WebApp?.colorScheme
      : undefined,
  ]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <Meta />
        <Links />
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider
          theme={{
            primaryColor: 'primary',
            colors: extraColors,
            // primaryShade: { dark: 3, light: 1 },
          }}
          forceColorScheme={colorScheme}
        >
          <Outlet />
          <ScrollRestoration />
          <Scripts />
          <LiveReload />
        </MantineProvider>
      </body>
    </html>
  );
}
