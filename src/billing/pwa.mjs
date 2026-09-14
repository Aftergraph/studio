let deferredPrompt = null;

function emitConnectivity() {
  window.dispatchEvent(new CustomEvent('billing-connectivity', {
    detail: { online: navigator.onLine }
  }));
}

export async function registerBillingPwa() {
  window.addEventListener('online', emitConnectivity);
  window.addEventListener('offline', emitConnectivity);
  emitConnectivity();

  // Capture install prompt
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    // ponytail: gate install banner behind auth — no reason to install before login
    if (document.body.classList.contains('is-authenticated')) {
        showInstallBanner();
    } else {
        window.addEventListener('billing:authenticated', () => showInstallBanner(), { once: true });
    }
  });

  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/billing/sw.js', { scope: '/billing/' });
  } catch (error) {
    console.warn('billing service worker registration failed', error);
    return null;
  }
}

function showInstallBanner() {
  if (!deferredPrompt) return;
  const existing = document.getElementById('billing-install-banner');
  if (existing) return;

  const banner = document.createElement('div');
  banner.id = 'billing-install-banner';
  banner.className = 'billing-install-banner';
  banner.setAttribute('role', 'alert');
  banner.innerHTML = `
    <div class="billing-install-content">
      <strong>Installer Fakturering</strong>
      <span>Tilføj til hjemmeskærm for hurtig adgang.</span>
    </div>
    <div class="billing-install-actions">
      <button type="button" class="billing-quiet-button" data-install="dismiss">Ikke nu</button>
      <button type="button" class="billing-primary-button" data-install="accept">Installer</button>
    </div>`;

  banner.querySelector('[data-install="accept"]').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      banner.remove();
    }
    deferredPrompt = null;
  });

  banner.querySelector('[data-install="dismiss"]').addEventListener('click', () => {
    banner.remove();
    deferredPrompt = null;
  });

  document.body.appendChild(banner);
}

registerBillingPwa();
