import test from 'node:test';
import assert from 'node:assert/strict';
import { configuredEnquiryOrigin, hasTrustedEnquiryOrigin } from '../src/server/enquiries/origin.ts';
import { MAX_ENQUIRY_BODY_BYTES, readBoundedEnquiryJson, validateEnquiry } from '../src/server/enquiries/validation.ts';

const valid = {
  name: '  مريم  ',
  email: ' Person@EXAMPLE.COM ',
  message: ' Please contact me.\r\nشكراً ',
  language: 'ar',
  consent: true,
};

test('normalizes valid bilingual enquiries and requires only one contact method', () => {
  assert.deepEqual(validateEnquiry(valid), {
    ok: true,
    enquiry: {
      name: 'مريم', email: 'Person@example.com', telephone: null,
      message: 'Please contact me.\nشكراً', propertyReference: null,
      language: 'ar', consent: true,
    },
  });
  const phoneOnly = validateEnquiry({
    ...valid, email: '', telephone: '+٩٧٣ (٣٩) ١٢-٣٤٥٦',
    propertyReference: 'ABCDEF12-3456-7890-ABCD-EF1234567890', language: 'en',
  });
  assert.equal(phoneOnly.ok, true);
  assert.equal(phoneOnly.enquiry.telephone, '+97339123456');
  assert.equal(phoneOnly.enquiry.propertyReference, 'abcdef12-3456-7890-abcd-ef1234567890');
  assert.equal(validateEnquiry({ ...valid, name: 'e\u0301' }).enquiry.name, 'é');
});

test('rejects invalid fields, consent, nonempty honeypots and unexpected input', () => {
  const invalidCases = [
    null, [], 'text', { ...valid, unexpected: 'x' },
    { ...valid, name: '' }, { ...valid, name: ' \nname' },
    { ...valid, name: 'a\u202eb' }, { ...valid, message: '\ud800' },
    { ...valid, message: ' \n ' }, { ...valid, email: '', telephone: '' },
    { ...valid, email: 'bad@@example.com' }, { ...valid, email: 'a@-example.com' },
    { ...valid, telephone: '123' }, { ...valid, telephone: '+97312345678 ext 1' },
    { ...valid, language: 'en-BH' }, { ...valid, consent: 'true' },
    { ...valid, consent: false }, { ...valid, propertyReference: '../property' },
    { ...valid, email: null }, { ...valid, honeypot: 1 },
  ];
  for (const input of invalidCases) assert.deepEqual(validateEnquiry(input), { ok: false, reason: 'invalid' });
  for (const honeypot of ['spam', ' ']) {
    assert.deepEqual(validateEnquiry({ ...valid, honeypot }), { ok: false, reason: 'honeypot' });
  }
  assert.equal(validateEnquiry({ ...valid, honeypot: '' }).ok, true);
  assert.equal(validateEnquiry({ ...valid, [Symbol('extra')]: 1 }).ok, false);
  const getter = { ...valid, get extra() { throw new Error('must not execute'); } };
  assert.equal(validateEnquiry(getter).ok, false);
});

test('enforces input bounds before and after normalization', () => {
  for (const [field, size] of Object.entries({
    name: 200, email: 320, telephone: 100, message: 10000, propertyReference: 36, honeypot: 200,
  })) {
    assert.equal(validateEnquiry({ ...valid, [field]: ' '.repeat(size + 1) }).ok, false, field);
  }
  assert.equal(validateEnquiry({ ...valid, message: 'x'.repeat(10000) }).ok, true);
});

function request(body, headers = {}) {
  return new Request('https://example.test/', { method: 'POST', body, headers, duplex: 'half' });
}

test('bounds and decodes the request stream without trusting Content-Length', async () => {
  assert.equal((await readBoundedEnquiryJson(request(JSON.stringify(valid)))).ok, true);
  assert.equal((await readBoundedEnquiryJson(request('{'))).ok, false);
  assert.equal((await readBoundedEnquiryJson(request(new Uint8Array([0xff])))).ok, false);
  assert.equal((await readBoundedEnquiryJson(request('{}', { 'content-length': 'invalid' }))).ok, false);
  assert.equal((await readBoundedEnquiryJson(request('{}', { 'content-length': String(MAX_ENQUIRY_BODY_BYTES + 1) }))).ok, false);
  assert.equal((await readBoundedEnquiryJson(request('x'.repeat(MAX_ENQUIRY_BODY_BYTES + 1), { 'content-length': '1' }))).ok, false);
  const duplicate = JSON.stringify(valid).replace('"name":', '"\\u006eame":"duplicate","name":');
  assert.deepEqual(await readBoundedEnquiryJson(request(duplicate)), { ok: false, reason: 'invalid' });
  const chunks = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_ENQUIRY_BODY_BYTES));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  });
  assert.equal((await readBoundedEnquiryJson(request(chunks))).ok, false);
});

test('requires a separately configured exact origin for unsafe requests', () => {
  const origin = configuredEnquiryOrigin('https://Example.COM:443/');
  assert.equal(origin, 'https://example.com');
  for (const value of [undefined, '', 'null', 'https://user@example.com', 'https://example.com/path',
    'https://example.com?', 'https://example.com#', ' http://localhost', 'http://example.com']) {
    assert.equal(configuredEnquiryOrigin(value), null);
  }
  assert.equal(configuredEnquiryOrigin('http://localhost:4321'), null);
  assert.equal(configuredEnquiryOrigin('http://localhost:4321', true), 'http://localhost:4321');
  assert.equal(configuredEnquiryOrigin('http://localhost.evil.test', true), null);
  const mutation = (headers = {}, method = 'POST') =>
    new Request('https://example.com/', { method, headers });
  assert.equal(hasTrustedEnquiryOrigin(mutation({ origin }), origin), true);
  assert.equal(hasTrustedEnquiryOrigin(mutation({ origin, 'sec-fetch-site': 'same-origin' }), origin), true);
  for (const headers of [{}, { origin: 'null' }, { origin: 'https://example.com.evil.test' },
    { origin, 'sec-fetch-site': 'cross-site' }, { origin, 'sec-fetch-site': 'same-site' }]) {
    assert.equal(hasTrustedEnquiryOrigin(mutation(headers), origin), false);
  }
  assert.equal(hasTrustedEnquiryOrigin(mutation({ origin }), null), false);
  assert.equal(hasTrustedEnquiryOrigin(mutation({ origin }), 'https://example.com/path'), false);
  assert.equal(hasTrustedEnquiryOrigin(mutation({ origin }, 'GET'), origin), false);
});
