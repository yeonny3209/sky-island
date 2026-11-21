// 퀘스트 진행 규칙 (B 담당). 데이터는 data/quests.json, data/npcs.json (엔진은 읽지 않고 game.data.raw로 넘겨준다).
// 저장은 엔진의 character.getQuest/setQuest 칸을 쓴다.
//   진행 중: { status: 'active', progress: [숫자, ...] }   끝남: { status: 'done' }
// 'collect' 목표는 저장하지 않고 가방 개수로 바로 센다.
import { josa } from './text.js';

export function createQuestBook(game) {
  const raw = game.data.raw ?? {};
  const list = Array.isArray(raw['/data/quests.json']) ? raw['/data/quests.json'] : [];
  const npcs = new Map((Array.isArray(raw['/data/npcs.json']) ? raw['/data/npcs.json'] : []).map((n) => [n.id, n]));
  const quests = new Map(list.map((q) => [q.id, q]));
  const ch = () => game.character;
  const saved = (id) => ch()?.getQuest(id) ?? null;

  function npc(id) {
    return npcs.get(id) ?? { id, name: id, title: '', greeting: '…' };
  }

  function objectiveLabel(o) {
    if (o.type === 'kill') return `${game.data.getMonster(o.target)?.name ?? o.target} 처치`;
    if (o.type === 'collect') return `${game.data.getItem(o.target)?.name ?? o.target} 모으기`;
    if (o.type === 'talk') return `${josa(npc(o.target).name, '과/와')} 대화`;
    return o.type;
  }

  function requirementsMet(q) {
    const req = q.requires ?? {};
    if ((req.level ?? 1) > ch().level) return false;
    return (req.quests ?? []).every((id) => saved(id)?.status === 'done');
  }

  /** 목표별 진행도 [{ ...목표, label, current, required, done }] */
  function progress(id) {
    const q = quests.get(id);
    const s = saved(id);
    return q.objectives.map((o, i) => {
      let current;
      if (s?.status === 'done') current = o.count;
      else if (o.type === 'collect') current = ch().countItem(o.target);
      else current = s?.progress?.[i] ?? 0;
      current = Math.min(current, o.count);
      return { ...o, label: objectiveLabel(o), current, required: o.count, done: current >= o.count };
    });
  }

  /** 'locked' | 'available' | 'active' | 'ready' | 'done' */
  function status(id) {
    const s = saved(id);
    if (s?.status === 'done') return 'done';
    if (s?.status === 'active') return progress(id).every((o) => o.done) ? 'ready' : 'active';
    return requirementsMet(quests.get(id)) ? 'available' : 'locked';
  }

  function accept(id) {
    if (status(id) !== 'available') return { ok: false, reason: '지금은 받을 수 없는 퀘스트예요.' };
    ch().setQuest(id, { status: 'active', progress: quests.get(id).objectives.map(() => 0) });
    return { ok: true };
  }

  /** 처치('kill')·대화('talk') 진행을 반영한다. */
  function record(type, target) {
    if (!ch()) return;
    for (const q of quests.values()) {
      const s = saved(q.id);
      if (s?.status !== 'active') continue;
      const next = [...(s.progress ?? [])];
      let touched = false;
      q.objectives.forEach((o, i) => {
        if (o.type === type && o.target === target && (next[i] ?? 0) < o.count) {
          next[i] = (next[i] ?? 0) + 1;
          touched = true;
        }
      });
      if (touched) ch().setQuest(q.id, { status: 'active', progress: next });
    }
  }

  function complete(id, npcId) {
    const q = quests.get(id);
    if (npcId && q.turnIn !== npcId) return { ok: false, reason: '이 NPC에게 보고하는 퀘스트가 아니에요.' };
    if (status(id) !== 'ready') return { ok: false, reason: '아직 목표를 다 채우지 못했어요.' };
    const c = ch();
    if (q.consumeOnComplete) {
      for (const o of q.objectives) if (o.type === 'collect') c.removeItem(o.target, o.count);
    }
    const r = q.rewards ?? {};
    c.setQuest(id, { status: 'done' });
    if (r.gold) c.addGold(r.gold);
    for (const it of r.items ?? []) c.addItem(it.itemId, it.count ?? 1);
    if (r.exp) c.addExp(r.exp);
    return { ok: true, rewards: r };
  }

  /** NPC 대화창에 보여 줄 퀘스트 */
  function forNpc(npcId) {
    const out = { ready: [], available: [], active: [] };
    for (const q of quests.values()) {
      const st = status(q.id);
      if (st === 'ready' && q.turnIn === npcId) out.ready.push(q);
      else if (st === 'available' && q.giver === npcId) out.available.push(q);
      else if ((st === 'active' || st === 'ready') && (q.giver === npcId || q.turnIn === npcId)) out.active.push(q);
    }
    return out;
  }

  /** 진행 중인 퀘스트 */
  function tracked() {
    return [...quests.values()]
      .filter((q) => ['active', 'ready'].includes(status(q.id)))
      .map((q) => ({ quest: q, status: status(q.id), objectives: progress(q.id) }));
  }

  /** 상태 사진 (바뀐 것을 찾아 알림을 띄울 때 쓴다) */
  function snapshot() {
    const snap = new Map();
    if (!ch()) return snap;
    for (const q of quests.values()) snap.set(q.id, `${status(q.id)}|${progress(q.id).map((o) => o.current).join(',')}`);
    return snap;
  }

  return { quests, npc, quest: (id) => quests.get(id), status, progress, accept, record, complete, forNpc, tracked, snapshot };
}
