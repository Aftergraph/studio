#!/usr/bin/env python3
import sys

# Fix 1: broken auth header template literal in browser-client.mjs
with open('src/billing/browser-client.mjs', 'r') as f:
    content = f.read()

old_auth = '  const authHeaders = () => (currentToken ? { authorization: *** ${currentToken}` } : {});'
new_auth = '  const authHeaders = () => (currentToken ? { authorization: `Bearer ${currentToken}` } : {});'
if old_auth not in content:
    print(f"Fix 1 FAILED: old auth line not found", file=sys.stderr)
    # Debug: show what's actually there
    for i, line in enumerate(content.split('\n')):
        if 'authorization:' in line and 'authHeaders' not in line:
            print(f"  Line {i+1}: {repr(line)}", file=sys.stderr)
    sys.exit(1)
content = content.replace(old_auth, new_auth)

# Fix 3: withTimeout timer leak cleanup
old_timeout = """  const withTimeout = (signal) => {
    if (typeof AbortController === 'undefined') return signal;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const combined = controller.signal;
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    // Note: caller must clear timeout on completion; simplified here by relying on abort
    return combined;
  };"""
new_timeout = """  const withTimeout = (signal) => {
    if (typeof AbortController === 'undefined') return signal;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    const combined = controller.signal;
    if (signal) {
      signal.addEventListener('abort', () => { controller.abort(); clearTimeout(timer); });
    }
    // Clear timer when the combined signal aborts to prevent leaks
    combined.addEventListener('abort', () => clearTimeout(timer), { once: true });
    return combined;
  };"""
if old_timeout not in content:
    print("Fix 3 FAILED: old withTimeout not found", file=sys.stderr)
    sys.exit(1)
content = content.replace(old_timeout, new_timeout)

with open('src/billing/browser-client.mjs', 'w') as f:
    f.write(content)
print("browser-client.mjs: fixes 1 and 3 applied")

# Fix 2: scheduler concurrency guard in billing-server.mjs
with open('server/billing-server.mjs', 'r') as f:
    srv = f.read()

old_sched = """  let schedulerTimer = null;
  const SCHEDULER_INTERVAL_MS = Number.parseInt(process.env.BILLING_SCHEDULER_INTERVAL_MS || '60000', 10);
  if (SCHEDULER_INTERVAL_MS > 0 && !process.env.BILLING_SCHEDULER_DISABLED) {
    schedulerTimer = setInterval(async () => {
      const tenantStores = server.workspace?.stores;
      if (!tenantStores || typeof tenantStores.forEach !== 'function') return;
      for (const [, entry] of tenantStores) {
        try {
          await entry.mutate((draft) => {
            const result = tickRecurringScheduler(draft.billing, { actor: 'scheduler' });
            draft.billing = result.billing;
            return draft;
          });
        } catch (err) {
          console.error('[scheduler] auto-tick failed for tenant store:', err?.message || err);
        }
      }
    }, SCHEDULER_INTERVAL_MS);"""
new_sched = """  let schedulerTimer = null;
  let schedulerRunning = false;
  const SCHEDULER_INTERVAL_MS = Number.parseInt(process.env.BILLING_SCHEDULER_INTERVAL_MS || '60000', 10);
  if (SCHEDULER_INTERVAL_MS > 0 && !process.env.BILLING_SCHEDULER_DISABLED) {
    schedulerTimer = setInterval(async () => {
      if (schedulerRunning) return;
      schedulerRunning = true;
      try {
        const tenantStores = server.workspace?.stores;
        if (!tenantStores || typeof tenantStores.forEach !== 'function') return;
        for (const [, entry] of tenantStores) {
          try {
            await entry.mutate((draft) => {
              const result = tickRecurringScheduler(draft.billing, { actor: 'scheduler' });
              draft.billing = result.billing;
              return draft;
            });
          } catch (err) {
            console.error('[scheduler] auto-tick failed for tenant store:', err?.message || err);
          }
        }
      } finally {
        schedulerRunning = false;
      }
    }, SCHEDULER_INTERVAL_MS);"""
if old_sched not in srv:
    print("Fix 2 FAILED: old scheduler block not found", file=sys.stderr)
    sys.exit(1)
srv = srv.replace(old_sched, new_sched)

# Fix 4: time-based audit log pruning + bounded memory
old_audit = """      // Append to billing.auditLog array in store
      await store.mutate((draft) => {
        if (!draft.billing) draft.billing = {};
        if (!Array.isArray(draft.billing.auditLog)) draft.billing.auditLog = [];
        draft.billing.auditLog.push(entry);
        // Keep last 1000 entries to prevent unbounded growth
        if (draft.billing.auditLog.length > 1000) {
          draft.billing.auditLog = draft.billing.auditLog.slice(-1000);
        }
        return draft;
      });"""
new_audit = """      // Append to billing.auditLog array in store
      await store.mutate((draft) => {
        if (!draft.billing) draft.billing = {};
        if (!Array.isArray(draft.billing.auditLog)) draft.billing.auditLog = [];
        draft.billing.auditLog.push(entry);
        // Time-based pruning: remove entries older than 90 days
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        draft.billing.auditLog = draft.billing.auditLog.filter((e) => e.timestamp >= cutoff);
        // Bounded memory: keep last 1000 entries max
        if (draft.billing.auditLog.length > 1000) {
          draft.billing.auditLog = draft.billing.auditLog.slice(-1000);
        }
        return draft;
      });"""
if old_audit not in srv:
    print("Fix 4 FAILED: old audit block not found", file=sys.stderr)
    sys.exit(1)
srv = srv.replace(old_audit, new_audit)

with open('server/billing-server.mjs', 'w') as f:
    f.write(srv)
print("billing-server.mjs: fixes 2 and 4 applied")

# Fix 5: recurring failure recording in auditLog
with open('src/billing/recurring.mjs', 'r') as f:
    rec = f.read()

old_catch = """    } catch (err) {
      // Log but don't fail other recurring invoices
      console.error(`[scheduler] Failed to generate invoice for ${recurring.id}:`, err.message);
    }"""
new_catch = """    } catch (err) {
      // Log but don't fail other recurring invoices
      console.error(`[scheduler] Failed to generate invoice for ${recurring.id}:`, err.message);
      // Record failure in audit log for observability
      next.auditLog ||= [];
      next.auditLog.push({
        type: 'billing.recurring.tick_failed',
        recurringId: recurring.id,
        customerId: recurring.customerId,
        actor: actor ?? 'scheduler',
        error: err?.message || String(err),
        timestamp: currentTime.toISOString(),
      });
    }"""
if old_catch not in rec:
    print("Fix 5 FAILED: old catch block not found", file=sys.stderr)
    sys.exit(1)
rec = rec.replace(old_catch, new_catch)

with open('src/billing/recurring.mjs', 'w') as f:
    f.write(rec)
print("recurring.mjs: fix 5 applied")
print("ALL 5 FIXES APPLIED SUCCESSFULLY")
