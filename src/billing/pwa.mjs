function emitConnectivity() {
  window.dispatchEvent(new CustomEvent('billing-connectivity', {
    detail: { online: navigator.onLine }
  }));
}

export async function registerBillingPwa() {
  window.addEventListener('online', emitConnectivity);
  window.addEventListener('offline', emitConnectivity);
  emitConnectivity();

  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/billing/sw.js', { scope: '/billing/' });
  } catch (error) {
    console.warn('billing service worker registration failed', error);
    return null;
  }
}

registerBillingPwa();
