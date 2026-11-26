import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('approved brand colors and accessible semantic text pairs are present', async () => {
  const tokens = (await read('src/styles/tokens.css')).toLowerCase();
  for (const color of ['#10243a', '#c4a36b', '#faf8f4', '#ffffff', '#263238', '#64748b', '#e2e8f0', '#166534', '#b91c1c']) {
    assert.ok(tokens.includes(color), `missing approved token ${color}`);
  }

  for (const [foreground, background] of [
    ['#10243a', '#ffffff'],
    ['#263238', '#ffffff'],
    ['#64748b', '#ffffff'],
    ['#596a80', '#faf8f4'],
    ['#10243a', '#c4a36b'],
    ['#ffffff', '#10243a'],
    ['#166534', '#f0fdf4'],
    ['#713f12', '#fffbeb'],
    ['#b91c1c', '#fef2f2'],
    ['#10243a', '#eff6ff'],
  ]) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} must meet AA`);
  }
  assert.ok(contrast('#c4a36b', '#ffffff') < 4.5, 'gold must not be used as white-surface text');
});

test('responsive, RTL, focus and reduced-motion foundations are defined', async () => {
  const [layout, global, typography, docs] = await Promise.all([
    read('src/styles/layout.css'),
    read('src/styles/global.css'),
    read('src/styles/typography.css'),
    read('docs/design-system.md'),
  ]);
  assert.match(layout, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(layout, /48rem/);
  assert.match(layout, /64rem/);
  assert.match(global, /:focus-visible/);
  assert.match(global, /prefers-reduced-motion/);
  assert.match(typography, /\[lang="ar"\]/);
  assert.match(docs, /Playfair Display/);
  assert.match(docs, /Inter/);
  assert.match(docs, /Tajawal/);
});

test('interactive component sources preserve touch targets and accessible field associations', async () => {
  const [button, field, badge, icon] = await Promise.all([
    read('src/components/ui/Button.astro'),
    read('src/components/ui/FormField.astro'),
    read('src/components/ui/Badge.astro'),
    read('src/components/ui/Icon.astro'),
  ]);
  assert.match(button, /min-height: var\(--target-min\)/);
  assert.match(field, /for=\{id\}/);
  assert.match(field, /aria-describedby=\{describedBy\}/);
  assert.match(field, /aria-invalid/);
  assert.match(badge, /<slot \/>/);
  assert.match(icon, /aria-hidden/);
});
