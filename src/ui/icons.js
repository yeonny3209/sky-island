// 아이콘. 데이터에 icon(PNG 경로)이 있으면 그 그림을, 없으면 glyph(임시 SVG)를 색만 바꿔서 쓴다.
import { h } from './dom.js';

const SVG = (body) => `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;

const GLYPHS = {
  // ---- 아이템 ----
  sword: SVG(`<path d="M17 31 37 9l5-3-3 5-20 22z" fill="currentColor"/><path d="m18.5 31 19-20.5 1.5-1.5L20 30.5z" fill="#fff" opacity=".5"/>
    <path d="m15.3 30.3 2.4 2.4-7 7-2.4-2.4z" fill="#5b3a1e"/><path d="m10 28 3-3 10 10-3 3z" fill="#8a5a2b"/><circle cx="8.6" cy="38.9" r="2.8" fill="#f2c14e"/>`),
  armor: SVG(`<path d="m14 10 6-2q4 4 8 0l6 2 6 6-4 6-2-2v20q-10 4-20 0V20l-2 2-4-6z" fill="currentColor"/>
    <path d="M24 15v24" stroke="#000" stroke-opacity=".18" stroke-width="2"/><path d="m17 12 3-1q4 4 8 0l3 1" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>`),
  amulet: SVG(`<path d="M12 6q12 20 24 0" fill="none" stroke="#d9b45a" stroke-width="2.5"/><path d="m24 22 9 9-9 13-9-13z" fill="currentColor"/>
    <path d="m24 22 9 9h-9z" fill="#fff" opacity=".45"/><circle cx="24" cy="22" r="3" fill="#e8c46a"/>`),
  feather: SVG(`<path d="M38 6C22 10 12 24 12 38l4-2c10-4 20-14 22-30z" fill="currentColor"/><path d="M36 9 10 42" stroke="#9aa3ad" stroke-width="2" stroke-linecap="round"/>`),
  potion: SVG(`<path d="M19 6h10v4h-2v6l9 11c4 6 1 15-8 15h-8c-9 0-12-9-8-15l9-11v-6h-2z" fill="#eef6ff" opacity=".9"/>
    <path d="M13.5 28h21c2 6-1 12-8 12h-5c-7 0-10-6-8-12z" fill="currentColor"/><rect x="19" y="4" width="10" height="5" rx="1.5" fill="#a0703f"/>
    <ellipse cx="18.5" cy="31.5" rx="1.8" ry="3.2" fill="#fff" opacity=".65"/>`),
  jelly: SVG(`<path d="M24 6S10 22 10 31a14 14 0 0 0 28 0C38 22 24 6 24 6z" fill="currentColor"/><ellipse cx="18.5" cy="29" rx="3" ry="5" fill="#fff" opacity=".55"/>`),
  mushroom: SVG(`<path d="M6 24C6 12 16 6 24 6s18 6 18 18z" fill="currentColor"/><rect x="18" y="23" width="12" height="17" rx="5" fill="#f6ead2"/>
    <circle cx="16" cy="16" r="3" fill="#fff" opacity=".85"/><circle cx="29" cy="12" r="2.4" fill="#fff" opacity=".85"/><circle cx="34" cy="19" r="2" fill="#fff" opacity=".85"/>`),
  tusk: SVG(`<path d="M12 40C10 24 22 10 40 8 30 14 22 24 20 40z" fill="currentColor"/><path d="M11 40h10v4H11z" fill="#8b6b4a"/>
    <path d="M16 34c0-10 8-20 18-23" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/>`),
  gem: SVG(`<path d="m24 5 15 12-6 24H15L9 17z" fill="currentColor"/><path d="m24 5 6 12-6 24-6-24z" fill="#fff" opacity=".25"/><path d="M9 17h30" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/>`),
  // ---- 스킬 ----
  slash: SVG(`<path d="M7 39C13 19 27 8 42 7 30 13 20 24 14 41z" fill="currentColor"/><path d="M34 30l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="currentColor" opacity=".8"/>`),
  dash: SVG(`<path d="m18 13 23 11-23 11 5-11z" fill="currentColor"/><path d="M4 17h12M7 24h12M4 31h12" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".7"/>`),
  whirl: SVG(`<path d="M22 24a2 2 0 1 1 4 0 6 6 0 1 1-12 0 10 10 0 1 1 20 0 14 14 0 1 1-28 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`),
  blessing: SVG(`<path d="M24 4c2 12 8 18 20 20-12 2-18 8-20 20-2-12-8-18-20-20 12-2 18-8 20-20z" fill="currentColor"/><circle cx="38" cy="10" r="2.5" fill="currentColor" opacity=".7"/><circle cx="10" cy="38" r="2" fill="currentColor" opacity=".7"/>`),
  wind: SVG(`<path d="M6 18h22a5 5 0 1 0-5-5M6 26h30a5 5 0 1 1-5 5M6 34h14" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>`),
  // ---- 화면 버튼 ----
  bag: SVG(`<path d="M17 16c0-9 14-9 14 0" fill="none" stroke="currentColor" stroke-width="3"/><path d="M10 16h28l3 24c0 2-1 4-4 4H11c-3 0-4-2-4-4z" fill="currentColor"/><rect x="20" y="22" width="8" height="6" rx="2" fill="#000" opacity=".25"/>`),
  scroll: SVG(`<rect x="12" y="8" width="24" height="32" rx="3" fill="currentColor"/><path d="M17 16h14M17 22h14M17 28h9" stroke="#000" stroke-opacity=".35" stroke-width="2.5" stroke-linecap="round"/>`),
  eye: SVG(`<path d="M4 24c6-10 34-10 40 0-6 10-34 10-40 0z" fill="currentColor"/><circle cx="24" cy="24" r="6" fill="#000" opacity=".35"/>`),
  chat: SVG(`<path d="M8 10h32a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H22l-8 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="currentColor"/>`),
  coin: SVG(`<circle cx="24" cy="24" r="16" fill="#f2c14e"/><circle cx="24" cy="24" r="11" fill="none" stroke="#c48a1c" stroke-width="2.5"/><path d="M24 17v14" stroke="#c48a1c" stroke-width="3" stroke-linecap="round"/>`),
  lock: SVG(`<rect x="12" y="22" width="24" height="18" rx="3" fill="currentColor"/><path d="M17 22v-5a7 7 0 0 1 14 0v5" fill="none" stroke="currentColor" stroke-width="3.5"/>`),
  close: SVG(`<path d="m14 14 20 20M34 14 14 34" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`),
  sort: SVG(`<path d="M10 14h28M14 24h20M18 34h12" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>`),
  send: SVG(`<path d="m6 24 36-16-10 34-8-14z" fill="currentColor"/>`),
};

const DEFAULT_GLYPH = { weapon: 'sword', armor: 'armor', helmet: 'armor', boots: 'armor', accessory: 'amulet', consumable: 'potion', material: 'gem' };

let iconBase = null;
/** 아이콘 PNG가 있는 폴더 (기본: 페이지 기준 icons/ = public/icons) */
export function setIconBase(url) {
  iconBase = url;
}

export function glyph(name, color) {
  return h('span', { class: 'si-glyph', style: color ? { '--glyph': color } : null, html: GLYPHS[name] ?? GLYPHS.gem });
}

/** 아이템·스킬 등 데이터 항목의 아이콘. PNG가 없거나 못 불러오면 glyph로 바꾼다. */
export function entryIcon(entry, fallbackName = 'gem') {
  const name = entry.glyph ?? DEFAULT_GLYPH[entry.slot] ?? DEFAULT_GLYPH[entry.type] ?? fallbackName;
  if (!entry.icon) return glyph(name, entry.color);
  const base = iconBase ?? new URL('icons/', document.baseURI);
  const img = h('img', { class: 'si-icon-img', src: new URL(entry.icon, base).href, alt: '', draggable: 'false' });
  img.addEventListener('error', () => img.replaceWith(glyph(name, entry.color)), { once: true });
  return img;
}
