// 한국어 문구 도우미. 받침 유무에 따라 조사(을/를, 이/가, 은/는, 과/와, 으로/로)를 고른다.

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const RIEUL = 8; // 종성 'ㄹ'의 번호

function finalConsonant(word) {
  const ch = String(word).trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) return (code - HANGUL_START) % 28;
  // 숫자는 읽는 소리 기준 (영·일·삼·육·칠·팔은 받침 있음)
  if (/[013678]/.test(ch)) return ch === '1' || ch === '7' || ch === '8' ? RIEUL : 1;
  return 0;
}

/**
 * josa('솔개', '과/와') → '솔개와',  josa('하늘섬', '으로/로') → '하늘섬으로'
 * 짝은 '받침 있을 때/없을 때' 순서로 적는다.
 */
export function josa(word, pair) {
  const [withFinal, withoutFinal] = pair.split('/');
  const fc = finalConsonant(word);
  if (pair === '으로/로') return word + (fc === 0 || fc === RIEUL ? withoutFinal : withFinal);
  return word + (fc === 0 ? withoutFinal : withFinal);
}
