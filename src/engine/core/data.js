// data/ 폴더의 모든 JSON을 빌드에 포함해 읽는다.
// 파일이 없어도 오류가 나지 않으므로 B가 data/classes.json, data/levels.json 등을 나중에 추가해도 된다.

import { buildGameData } from './dataBuilder.js';

const files = import.meta.glob('/data/**/*.json', { eager: true, import: 'default' });

let cached = null;

export function loadGameData() {
  if (cached) return cached;
  cached = buildGameData(files);
  if (cached.warnings.length) {
    console.groupCollapsed(`[데이터] 확인할 것 ${cached.warnings.length}개`);
    for (const w of cached.warnings) console.warn(w);
    console.groupEnd();
  }
  return cached;
}
