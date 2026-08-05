import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from './scoreDialogs.js';

// The scoring dialogs build their markup as an HTML string, and the rubric
// level names/descriptions in it are admin-authored (Administration > System
// Settings > Evaluation Criteria). Anything typed there reaches innerHTML, so
// escaping is a security boundary, not cosmetics.

test('escapes the characters that could break out of markup', () => {
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
  assert.equal(escapeHtml('say "hi"'), 'say &quot;hi&quot;');
  assert.equal(escapeHtml("it's"), 'it&#39;s');
});

test('neutralises a script tag typed into a rubric label', () => {
  const out = escapeHtml('Complete <script>alert(1)</script>');
  assert.equal(out.includes('<script>'), false);
  assert.equal(out, 'Complete &lt;script&gt;alert(1)&lt;/script&gt;');
});

test('neutralises an attribute-breaking value', () => {
  // Rubric points are interpolated into a value="..." attribute.
  const out = escapeHtml('" onfocus="alert(1)');
  assert.equal(out.includes('"'), false);
  assert.equal(out, '&quot; onfocus=&quot;alert(1)');
});

test('escapes every occurrence, not just the first', () => {
  assert.equal(escapeHtml('<<>>'), '&lt;&lt;&gt;&gt;');
  assert.equal(escapeHtml('&&'), '&amp;&amp;');
});

test('leaves ordinary rubric text untouched', () => {
  const label = 'Highly Disadvantaged (₱5 – ₱150)';
  assert.equal(escapeHtml(label), label);
});

test('renders null/undefined as an empty string rather than "null"', () => {
  // Optional fields like cedula/electric can be missing on a custom criterion.
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('coerces numbers, which is how points are passed in', () => {
  assert.equal(escapeHtml(20), '20');
  assert.equal(escapeHtml(0), '0');
});
