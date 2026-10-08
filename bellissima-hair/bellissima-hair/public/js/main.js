import { state, get, getToken, setSession, refreshChrome, startRouter } from './core.js';
import './home.js';
import './services.js';
import './shop.js';
import './community.js';
import './auth.js';
import './account.js';

async function boot() {
  try {
    state.meta = await get('/api/meta');
  } catch {
    document.getElementById('app').innerHTML =
      '<div class="container section"><div class="empty"><span class="emoji">📡</span><h1>Service momentanément indisponible</h1><p class="muted">Réessayez dans quelques instants.</p></div></div>';
    return;
  }
  if (getToken()) {
    try { state.user = (await get('/api/me')).user; } catch { setSession(null, null); }
  }
  refreshChrome();
  startRouter();
}
boot();
