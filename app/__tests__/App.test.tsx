/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

// SafeAreaProvider withholds its children until a layout measurement that never happens under the
// test renderer; replace it with a passthrough and static insets so the screen actually renders.
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({children}: {children: unknown}) => children,
  useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
}));

test('renders the home screen with its title and entry tiles', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  const rendered = JSON.stringify(tree?.toJSON());
  expect(rendered).toContain('Snarl');
  expect(rendered).toContain('Consent & age-gate');
  expect(rendered).toContain('Record a delivery');
});
