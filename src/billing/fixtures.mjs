export function emptyBillingState() {
  return {
    customers: [],
    visits: [],
    invoices: [],
    settings: { taxRateBps: 2500, locale: 'da-DK', issuer: null, invoiceSequence: { nextNumber: 1 }, defaultServiceLabel: 'Service' },
  };
}

function actual({ startedAt, endedAt, workers, workMinutes, discountPercent = undefined }) {
  return {
    startedAt,
    endedAt,
    workers,
    workMinutes,
    ...(discountPercent === undefined ? {} : { discountPercent }),
  };
}

/**
 * Privacy-minimal reference data for the Studio billing incubation surface.
 * These fixtures intentionally exclude operational access instructions,
 * credentials, keys, alarm details and provider-specific identifiers.
 */
export function billingFixtureState() {
  return {
    settings: {
      taxRateBps: 2500, locale: 'da-DK', defaultServiceLabel: 'Rengøring',
      invoiceSequence: { nextNumber: 1370 },
      issuer: {
        name: 'Rendetalje', address: 'Gammel Viborgvej 40, 8381 Tilst', cvr: '45564096',
        countryCode: 'DK', registrationId: '45564096', registrationSchemeId: '0184',
        endpoint: { schemeId: '0184', value: '45564096' },
        email: 'info@rendetalje.dk', phone: '+45 22 65 02 26',
        paymentText: 'Betal digitalt via MobilePay eller bankoverførsel.',
      },
    },
    invoices: [],
    customers: [
      {
        id: 'customer-katrine',
        name: 'Katrine Rindom Andersen',
        address: 'Eksempelvej 3A, 8883 Testby',
        email: 'katrine@example.test',
        status: 'active',
        billing: { mode: 'per_visit', paymentTermsDays: 8, rateMinor: 34900, currency: 'DKK', discountPercent: 0 },
      },
      {
        id: 'customer-anton',
        name: 'Anton Horsbøl Skjeldmoes',
        address: 'Eksempelvej 29, 8210 Testby',
        email: 'anton@example.test',
        status: 'active',
        billing: { mode: 'monthly_batch', paymentTermsDays: 8, rateMinor: 34900, currency: 'DKK', discountPercent: 10 },
      },
      {
        id: 'customer-heidi',
        name: 'Heidi',
        address: 'Eksempelvej 24, 8930 Testby',
        email: 'heidi@example.test',
        status: 'active',
        billing: { mode: 'monthly_batch', paymentTermsDays: 8, rateMinor: 34900, currency: 'DKK', discountPercent: 0 },
      },
      {
        id: 'customer-casper-nora',
        name: 'Casper & Nora',
        address: 'Eksempelvej 8, 8000 Testby',
        email: 'casper-nora@example.test',
        status: 'active',
        billing: { mode: 'monthly_batch', paymentTermsDays: 8, rateMinor: 34900, currency: 'DKK', discountPercent: 0 },
      },
      {
        id: 'customer-peder',
        name: 'Peder Kjær',
        address: 'Eksempelvej 2, 8000 Testby',
        email: 'peder@example.test',
        status: 'active',
        billing: { mode: 'per_visit', paymentTermsDays: 8, rateMinor: 34900, currency: 'DKK', discountPercent: 0 },
      },
    ],
    visits: [
      {
        id: 'katrine-2026-09-07', customerId: 'customer-katrine',
        scheduledStart: '2026-09-07T08:00:00+02:00', scheduledEnd: '2026-09-07T12:20:00+02:00', status: 'completed',
        actual: actual({ startedAt: '2026-09-07T08:00:00+02:00', endedAt: '2026-09-07T12:20:00+02:00', workers: 3, workMinutes: 780 }),
      },
      {
        id: 'katrine-2026-10-05', customerId: 'customer-katrine',
        scheduledStart: '2026-10-05T08:00:00+02:00', scheduledEnd: '2026-10-05T12:20:00+02:00', status: 'planned',
      },
      {
        id: 'anton-2026-09-09', customerId: 'customer-anton',
        scheduledStart: '2026-09-09T11:00:00+02:00', scheduledEnd: '2026-09-09T12:30:00+02:00', status: 'completed',
        actual: actual({ startedAt: '2026-09-09T11:00:00+02:00', endedAt: '2026-09-09T12:30:00+02:00', workers: 2, workMinutes: 180, discountPercent: 10 }),
      },
      {
        id: 'anton-2026-09-23', customerId: 'customer-anton',
        scheduledStart: '2026-09-23T11:00:00+02:00', scheduledEnd: '2026-09-23T12:30:00+02:00', status: 'planned',
      },
      {
        id: 'heidi-2026-09-08', customerId: 'customer-heidi',
        scheduledStart: '2026-09-08T08:00:00+02:00', scheduledEnd: '2026-09-08T10:30:00+02:00', status: 'completed',
        actual: actual({ startedAt: '2026-09-08T08:00:00+02:00', endedAt: '2026-09-08T10:00:00+02:00', workers: 2, workMinutes: 240 }),
      },
      {
        id: 'heidi-2026-09-22', customerId: 'customer-heidi',
        scheduledStart: '2026-09-22T08:00:00+02:00', scheduledEnd: '2026-09-22T10:30:00+02:00', status: 'planned',
      },
      {
        id: 'casper-nora-2026-09-08', customerId: 'customer-casper-nora',
        scheduledStart: '2026-09-08T11:30:00+02:00', scheduledEnd: '2026-09-08T13:30:00+02:00', status: 'completed',
        actual: actual({ startedAt: '2026-09-08T11:30:00+02:00', endedAt: '2026-09-08T13:30:00+02:00', workers: 2, workMinutes: 240 }),
      },
      {
        id: 'casper-nora-2026-09-15', customerId: 'customer-casper-nora',
        scheduledStart: '2026-09-15T11:30:00+02:00', scheduledEnd: '2026-09-15T13:30:00+02:00', status: 'planned',
      },
      {
        id: 'casper-nora-2026-09-22', customerId: 'customer-casper-nora',
        scheduledStart: '2026-09-22T11:30:00+02:00', scheduledEnd: '2026-09-22T13:30:00+02:00', status: 'planned',
      },
      {
        id: 'casper-nora-2026-09-29', customerId: 'customer-casper-nora',
        scheduledStart: '2026-09-29T11:30:00+02:00', scheduledEnd: '2026-09-29T13:30:00+02:00', status: 'planned',
      },
      {
        id: 'peder-2026-09-02', customerId: 'customer-peder',
        scheduledStart: '2026-09-02T08:30:00+02:00', scheduledEnd: '2026-09-02T09:30:00+02:00', status: 'completed',
      },
    ],
  };
}
