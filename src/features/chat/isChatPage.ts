/** Chat is the Analysis Center page with `?app=Chat`. It replaces the page chrome with a slim frame. */
export const isChatPage = (pathname: string, app: unknown): boolean =>
  pathname === '/' && app === 'Chat';
