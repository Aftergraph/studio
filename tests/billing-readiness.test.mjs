import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBilling } from '../src/billing/readiness.mjs';
import { projectInvoice } from '../src/billing/money.mjs';

const DKK = 'DKK';

function customer(overrides={}) {
  return {
    id:'c1', name:'Katrine', address:'Customer Street 1', email:'k@example.test', status:'active',
    billing:{ mode:'per_visit', paymentTermsDays:8, rateMinor:34900, currency:DKK, discountPercent:0 },
    ...overrides,
  };
}

function completedVisit(id='v1', date='2026-09-07T08:00:00+02:00', actual={workMinutes:780,workers:3}) {
  return { id, customerId:'c1', scheduledStart:date, scheduledEnd:date, status:'completed', actual:{startedAt:date,endedAt:date,...actual} };
}

function queueFor(result, status) {
  return result.items.filter(item=>item.status===status);
}

test('per-visit billing becomes ready after a completed visit with actuals',()=>{
  const result=evaluateBilling({customers:[customer()],visits:[completedVisit()],invoices:[],now:'2026-09-11T10:00:00+02:00'});
  assert.equal(queueFor(result,'ready').length,1);
  assert.deepEqual(queueFor(result,'ready')[0].visitIds,['v1']);
  assert.equal(queueFor(result,'ready')[0].reasonCode,'billing_window_closed');
});

test('monthly batch waits while another planned visit remains in the same month',()=>{
  const c=customer({id:'c1',name:'Anton',billing:{mode:'monthly_batch',paymentTermsDays:8,rateMinor:34900,currency:DKK,discountPercent:10}});
  const visits=[
    completedVisit('anton-0909','2026-09-09T11:00:00+02:00',{workMinutes:180,workers:2}),
    {id:'anton-0923',customerId:'c1',scheduledStart:'2026-09-23T11:00:00+02:00',scheduledEnd:'2026-09-23T12:30:00+02:00',status:'planned'},
  ];
  const result=evaluateBilling({customers:[c],visits,invoices:[],now:'2026-09-11T10:00:00+02:00'});
  assert.equal(queueFor(result,'waiting').length,1);
  assert.equal(queueFor(result,'waiting')[0].reasonCode,'future_visit_same_window');
  assert.equal(queueFor(result,'waiting')[0].nextVisitId,'anton-0923');
});

test('completed visit without actuals fails closed to needs_info',()=>{
  const visit={id:'peder-0902',customerId:'c1',scheduledStart:'2026-09-02T08:30:00+02:00',scheduledEnd:'2026-09-02T09:30:00+02:00',status:'completed'};
  const result=evaluateBilling({customers:[customer({name:'Peder'})],visits:[visit],invoices:[],now:'2026-09-11T10:00:00+02:00'});
  assert.equal(queueFor(result,'needs_info').length,1);
  assert.equal(queueFor(result,'needs_info')[0].reasonCode,'missing_actuals');
});

test('a visit already bound to a non-void invoice is not billable twice',()=>{
  const invoices=[{id:'i1',number:'1369',customerId:'c1',visitIds:['v1'],status:'issued'}];
  const result=evaluateBilling({customers:[customer()],visits:[completedVisit()],invoices,now:'2026-09-11T10:00:00+02:00'});
  assert.equal(queueFor(result,'invoiced').length,1);
  assert.equal(queueFor(result,'ready').length,0);
  assert.equal(queueFor(result,'invoiced')[0].invoiceId,'i1');
});

test('a visit in the next month does not keep the current monthly billing window open',()=>{
  const c=customer({billing:{mode:'monthly_batch',paymentTermsDays:8,rateMinor:34900,currency:DKK,discountPercent:0}});
  const visits=[
    completedVisit('sep','2026-09-28T08:00:00+02:00',{workMinutes:120,workers:2}),
    {id:'oct',customerId:'c1',scheduledStart:'2026-10-05T08:00:00+02:00',scheduledEnd:'2026-10-05T10:00:00+02:00',status:'planned'},
  ];
  const result=evaluateBilling({customers:[c],visits,invoices:[],now:'2026-09-29T10:00:00+02:00'});
  assert.equal(queueFor(result,'ready').length,1);
  assert.deepEqual(queueFor(result,'ready')[0].visitIds,['sep']);
});

test('invoice projection uses actual minutes, inclusive VAT and deterministic discount rounding',()=>{
  const c=customer({billing:{mode:'per_visit',paymentTermsDays:8,rateMinor:34900,currency:DKK,discountPercent:10}});
  const invoice=projectInvoice({customer:c,visits:[completedVisit('v1','2026-09-09T11:00:00+02:00',{workMinutes:180,workers:2})],taxRateBps:2500});
  assert.equal(invoice.subtotalGrossMinor,104700);
  assert.equal(invoice.discountMinor,10470);
  assert.equal(invoice.totalGrossMinor,94230);
  assert.equal(invoice.totalNetMinor,75384);
  assert.equal(invoice.taxMinor,18846);
  assert.equal(invoice.currency,DKK);
});

test('missing customer address fails closed before invoice readiness',()=>{
  const c=customer({address:''});
  const result=evaluateBilling({
    customers:[c], visits:[completedVisit()], invoices:[],
    settings:{issuer:{name:'Seller',address:'Street 1',cvr:'12345678'}},
  });
  assert.equal(queueFor(result,'needs_info')[0].reasonCode,'missing_customer_address');
});

test('missing issuer profile fails closed before invoice readiness',()=>{
  const c=customer({address:'Customer Street 1'});
  const result=evaluateBilling({customers:[c],visits:[completedVisit()],invoices:[],settings:{}});
  assert.equal(queueFor(result,'needs_info')[0].reasonCode,'missing_issuer_profile');
});
