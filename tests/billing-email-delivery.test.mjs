import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSmtpBillingDeliveryAdapter, composeInvoiceEmail } from '../server/billing-email-adapter.mjs';

function makeInvoice(overrides = {}) {
  return {
    id: 'invoice-1370',
    number: '1370',
    issueDate: '2026-09-01',
    dueDate: '2026-09-15',
    currency: 'DKK',
    totalGrossMinor: 125000,
    customerSnapshot: {
      name: 'Test Kunde ApS',
      email: 'kunde@test.dk',
      address: 'Vestergade 1, 8000 Aarhus C',
    },
    issuerSnapshot: {
      name: 'Aftergraph Studio',
      email: 'billing@aftergraph.org',
      phone: '+45 12345678',
      logoUrl: null,
    },
    ...overrides,
  };
}

function makeArtifact() {
  return {
    contentType: 'application/pdf',
    filename: 'invoice-1370.pdf',
    body: Buffer.from('%PDF-1.4 fake pdf content'),
  };
}

describe('composeInvoiceEmail', () => {
  it('composes Danish email with correct subject and amount formatting', () => {
    const invoice = makeInvoice();
    const result = composeInvoiceEmail({ invoice, customer: null, issuer: invoice.issuerSnapshot });
    assert.equal(result.subject, 'Faktura nr. 1370 fra Aftergraph Studio');
    assert.match(result.text, /Kære Test Kunde ApS/);
    assert.match(result.text, /1.250,00 DKK/);
    assert.match(result.text, /Fakturadato: 2026-09-01/);
    assert.match(result.text, /Forfaldsdato: 2026-09-15/);
    assert.match(result.html, /<html lang="da">/);
    assert.match(result.html, /1.250,00 DKK/);
  });

  it('falls back to default issuer name when missing', () => {
    const invoice = makeInvoice({ issuerSnapshot: {} });
    const result = composeInvoiceEmail({ invoice, customer: null, issuer: {} });
    assert.equal(result.subject, 'Faktura nr. 1370 fra Aftergraph Studio');
  });
});

describe('createSmtpBillingDeliveryAdapter', () => {
  it('throws when host is missing', () => {
    assert.throws(() => createSmtpBillingDeliveryAdapter({ from: 'test@test.dk' }), (err) => {
      assert.equal(err.code, 'smtp_host_required');
      return true;
    });
  });

  it('throws when from is missing', () => {
    assert.throws(() => createSmtpBillingDeliveryAdapter({ host: 'smtp.test.dk' }), (err) => {
      assert.equal(err.code, 'smtp_from_required');
      return true;
    });
  });

  it('delivers via mock transport and returns messageId', async () => {
    let sentMail = null;
    const mockTransport = {
      sendMail: async (options) => {
        sentMail = options;
        return { messageId: '<mock-msg-id@test>' };
      },
    };
    const adapter = createSmtpBillingDeliveryAdapter({
      host: 'smtp.test.dk',
      port: 587,
      user: 'user@test.dk',
      pass: 'secret',
      from: 'billing@aftergraph.org',
      transportOverride: mockTransport,
    });
    assert.equal(adapter.name, 'smtp');
    const invoice = makeInvoice();
    const artifact = makeArtifact();
    const receipt = await adapter.deliver({
      invoice,
      customer: null,
      artifact,
      attemptId: 'attempt-1',
    });
    assert.equal(receipt.messageId, '<mock-msg-id@test>');
    assert.ok(receipt.deliveredAt);
    assert.equal(sentMail.to, 'kunde@test.dk');
    assert.equal(sentMail.from, 'billing@aftergraph.org');
    assert.match(sentMail.subject, /Faktura nr. 1370/);
    assert.equal(sentMail.attachments.length, 1);
    assert.equal(sentMail.attachments[0].filename, 'invoice-1370.pdf');
    assert.equal(sentMail.headers['X-Aftergraph-Delivery-Attempt'], 'attempt-1');
  });

  it('throws delivery_recipient_missing when no email', async () => {
    const mockTransport = { sendMail: async () => ({ messageId: 'x' }) };
    const adapter = createSmtpBillingDeliveryAdapter({
      host: 'smtp.test.dk',
      from: 'billing@aftergraph.org',
      transportOverride: mockTransport,
    });
    const invoice = makeInvoice({ customerSnapshot: { name: 'No Email', email: null } });
    await assert.rejects(
      () => adapter.deliver({ invoice, customer: null, artifact: makeArtifact() }),
      (err) => err.code === 'delivery_recipient_missing',
    );
  });

  it('wraps SMTP errors without exposing credentials', async () => {
    const mockTransport = {
      sendMail: async () => {
        const err = new Error('Authentication failed');
        err.code = 'EAUTH';
        err.responseCode = 535;
        throw err;
      },
    };
    const adapter = createSmtpBillingDeliveryAdapter({
      host: 'smtp.test.dk',
      user: 'secret-user',
      pass: 'secret-pass',
      from: 'billing@aftergraph.org',
      transportOverride: mockTransport,
    });
    const invoice = makeInvoice();
    await assert.rejects(
      () => adapter.deliver({ invoice, customer: null, artifact: makeArtifact() }),
      (err) => {
        assert.equal(err.code, 'smtp_send_failed:535');
        assert.equal(err.status, 502);
        // Ensure credentials are not in error message
        assert.ok(!err.message.includes('secret-user'));
        assert.ok(!err.message.includes('secret-pass'));
        return true;
      },
    );
  });

  it('uses customer email fallback when snapshot email is missing', async () => {
    let sentTo = null;
    const mockTransport = {
      sendMail: async (options) => {
        sentTo = options.to;
        return { messageId: '<fallback@test>' };
      },
    };
    const adapter = createSmtpBillingDeliveryAdapter({
      host: 'smtp.test.dk',
      from: 'billing@aftergraph.org',
      transportOverride: mockTransport,
    });
    const invoice = makeInvoice({ customerSnapshot: { name: 'Fallback', email: null } });
    const customer = { email: 'fallback@customer.dk' };
    await adapter.deliver({ invoice, customer, artifact: makeArtifact() });
    assert.equal(sentTo, 'fallback@customer.dk');
  });
});
