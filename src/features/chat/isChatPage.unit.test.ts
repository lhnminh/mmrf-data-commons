import { isChatPage } from './isChatPage';

describe('isChatPage', () => {
  it.each<[string, unknown, boolean]>([
    ['/', 'Chat', true],
    ['/', 'OncoMatrix', false],
    ['/', undefined, false],
    ['/cases/1', 'Chat', false],
    ['/', ['Chat'], false],
  ])('for %s with app %j is %s', (pathname, app, expected) => {
    expect(isChatPage(pathname, app)).toBe(expected);
  });
});
