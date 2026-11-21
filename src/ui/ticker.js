// 재사용 대기·버프 시간처럼 움직이는 표시가 있을 때만 도는 requestAnimationFrame 루프.
// 등록한 함수가 false를 돌려주면 빠진다. 할 일이 없으면 루프도 멈춘다.
export function createTicker() {
  const fns = new Set();
  let raf = 0;
  const loop = () => {
    const now = performance.now();
    for (const fn of [...fns]) if (fn(now) === false) fns.delete(fn);
    raf = fns.size ? requestAnimationFrame(loop) : 0;
  };
  return {
    add(fn) {
      fns.add(fn);
      if (!raf) raf = requestAnimationFrame(loop);
    },
    stop() {
      cancelAnimationFrame(raf);
      fns.clear();
      raf = 0;
    },
  };
}
