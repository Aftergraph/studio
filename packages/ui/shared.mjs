import { AGIcon } from '../icons/index.mjs';
export { AGIcon };
export const esc=(v='')=>String(v).replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]));
export const attr=(v='')=>esc(v);
