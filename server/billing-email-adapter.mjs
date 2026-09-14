import nodemailer from 'nodemailer';

function adapterError(code, status = 502) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Build Danish email body for invoice delivery.
 * Never includes credentials or internal IDs beyond what the customer needs.
 */
export function composeInvoiceEmail({ invoice, customer, issuer }) {
  const customerName = invoice?.customerSnapshot?.name || customer?.name || 'Kunde';
  const issuerName = issuer?.name || 'Aftergraph Studio';
  const currency = invoice?.currency || 'DKK';
  const amountMinor = Number(invoice?.totalGrossMinor || 0);
  const amountFormatted = `${new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountMinor / 100)} ${currency}`;
  const invoiceNumber = invoice?.number || '';
  const issueDate = invoice?.issueDate || '';
  const dueDate = invoice?.dueDate || '';

  const subject = `Faktura nr. ${invoiceNumber} fra ${issuerName}`;

  const text = [
    `Kære ${customerName},`,
    '',
    `Vedlagt finder du faktura nr. ${invoiceNumber}.`,
    '',
    `Fakturadato: ${issueDate}`,
    `Forfaldsdato: ${dueDate}`,
    `Beløb: ${amountFormatted}`,
    '',
    'Har du spørgsmål til fakturaen, er du velkommen til at kontakte os.',
    '',
    'Med venlig hilsen',
    issuerName,
    issuer?.email || '',
    issuer?.phone || '',
  ].filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== '')).join('\n');

  const html = `<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1a1a1a;line-height:1.6;max-width:600px;margin:0 auto;padding:24px">
  <div style="margin-bottom:24px">
    <h1 style="font-size:20px;margin:0 0 4px">${issuerName}</h1>
    ${issuer?.logoUrl ? `<img src="${issuer.logoUrl}" alt="${issuerName}" style="max-height:48px;margin-top:8px">` : ''}
  </div>
  <p>Kære ${customerName},</p>
  <p>Vedlagt finder du <strong>faktura nr. ${invoiceNumber}</strong>.</p>
  <table style="border-collapse:collapse;margin:16px 0;width:100%">
    <tr><td style="padding:4px 12px 4px 0;color:#555">Fakturadato</td><td style="padding:4px 0">${issueDate}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#555">Forfaldsdato</td><td style="padding:4px 0">${dueDate}</td></tr>
    <tr><td style="padding:4px 12px 4px 0;color:#555">Beløb</td><td style="padding:4px 0;font-weight:600">${amountFormatted}</td></tr>
  </table>
  <p>Har du spørgsmål til fakturaen, er du velkommen til at kontakte os.</p>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0">
  <p style="font-size:13px;color:#666">Med venlig hilsen<br>${issuerName}${issuer?.email ? `<br><a href="mailto:${issuer.email}">${issuer.email}</a>` : ''}${issuer?.phone ? `<br>${issuer.phone}` : ''}</p>
</body>
</html>`;

  return { subject, text, html };
}

/**
 * Create a nodemailer-based billing delivery adapter.
 * SMTP credentials are read from env vars at construction time and never logged.
 */
export function createSmtpBillingDeliveryAdapter({
  host,
  port,
  user,
  pass,
  from,
  secure = false,
  transportOverride = null,
} = {}) {
  if (!host) throw adapterError('smtp_host_required', 500);
  if (!from) throw adapterError('smtp_from_required', 500);

  let transport;
  if (transportOverride) {
    // Allow test/mock transport injection
    transport = transportOverride;
  } else {
    transport = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Boolean(secure),
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

  return Object.freeze({
    name: 'smtp',

    async deliver({ invoice, customer, artifact, attemptId } = {}) {
      const recipientEmail = invoice?.customerSnapshot?.email || customer?.email;
      if (!recipientEmail) throw adapterError('delivery_recipient_missing', 422);
      if (!artifact?.body || !artifact?.filename || !artifact?.contentType) {
        throw adapterError('delivery_artifact_invalid', 500);
      }

      const issuer = invoice?.issuerSnapshot || {};
      const { subject, text, html } = composeInvoiceEmail({ invoice, customer, issuer });

      const mailOptions = {
        from,
        to: recipientEmail,
        subject,
        text,
        html,
        attachments: [{
          filename: artifact.filename,
          content: artifact.body,
          contentType: artifact.contentType,
        }],
        ...(attemptId ? { headers: { 'X-Aftergraph-Delivery-Attempt': String(attemptId) } } : {}),
      };

      let info;
      try {
        info = await transport.sendMail(mailOptions);
      } catch (err) {
        // Never log credentials or full error details that might contain them
        const safeCode = err?.responseCode || err?.code || 'smtp_send_failed';
        throw adapterError(`smtp_send_failed:${safeCode}`, 502);
      }

      return {
        messageId: info?.messageId || `smtp-${Date.now()}`,
        deliveredAt: new Date().toISOString(),
      };
    },
  });
}

/**
 * Build SMTP adapter from environment variables.
 * Returns null if required vars are missing (fail-closed).
 */
export function smtpBillingDeliveryAdapterFromEnv(env = process.env) {
  const host = String(env.AFTERGRAPH_SMTP_HOST || '').trim();
  const from = String(env.AFTERGRAPH_SMTP_FROM || '').trim();
  if (!host || !from) return null;
  return createSmtpBillingDeliveryAdapter({
    host,
    port: env.AFTERGRAPH_SMTP_PORT || 587,
    user: String(env.AFTERGRAPH_SMTP_USER || '').trim() || undefined,
    pass: String(env.AFTERGRAPH_SMTP_PASS || '').trim() || undefined,
    from,
    secure: env.AFTERGRAPH_SMTP_SECURE === 'true',
  });
}
