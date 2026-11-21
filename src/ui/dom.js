// 작은 DOM 도우미. 글자는 항상 텍스트 노드로 넣는다 (채팅 등 외부 입력이 HTML로 해석되지 않게).

/**
 * h('div', { class: 'si-x', onclick: fn, style: { '--fill': '50%' } }, '글자', 자식요소)
 * html 속성은 코드 안의 SVG 문자열처럼 믿을 수 있는 값에만 쓴다.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style' && typeof value === 'object') setStyle(el, value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key === 'html') el.innerHTML = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function setStyle(el, styles) {
  for (const [key, value] of Object.entries(styles)) {
    if (key.startsWith('--')) el.style.setProperty(key, value);
    else el.style[key] = value;
  }
}

/** 자식을 모두 바꾼다. */
export function replace(el, ...children) {
  el.replaceChildren();
  return append(el, children);
}
