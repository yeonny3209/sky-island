// 로그인과 캐릭터 불러오기·만들기·저장.
//  - 온라인: Supabase Auth(이메일+비밀번호) + characters 테이블 (supabase/migrations 참고)
//  - 오프라인: 이 브라우저 localStorage. 이름(프로필)별로 따로 저장된다.
// 주소에 ?offline 을 붙이면 .env가 있어도 오프라인 모드로 켠다 (탭 여러 개로 멀티 시험용).

import { supabase, supabaseConfigError } from './supabaseClient.js';
import { Character } from './character.js';

const LS = {
  profiles: 'sky-island:offline:profiles',
  last: 'sky-island:offline:last',
  char: (profile) => `sky-island:offline:char:${profile}`,
};

export const NAME_RULE = /^[가-힣A-Za-z0-9_-]{2,12}$/;
export const NAME_RULE_TEXT = '이름은 2~12자, 한글·영문·숫자·_·- 만 쓸 수 있어요';

function lsGet(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Supabase 오류 → 한국어 안내 */
export function koreanError(error) {
  if (!error) return '';
  const msg = String(error.message || error);
  const code = error.code || '';
  if (/Invalid login credentials/i.test(msg)) return '이메일 또는 비밀번호가 틀렸습니다';
  if (/User already registered/i.test(msg)) return '이미 가입된 이메일입니다. 로그인해 주세요';
  if (/Email not confirmed/i.test(msg)) return '이메일 확인이 아직 안 됐습니다. 메일함의 확인 링크를 눌러 주세요';
  if (/Password should be at least/i.test(msg)) return '비밀번호는 6자 이상이어야 합니다';
  if (/Unable to validate email address|invalid format/i.test(msg)) return '이메일 형식이 올바르지 않습니다';
  if (/rate limit/i.test(msg)) return '요청이 너무 많습니다. 잠시 뒤에 다시 해 주세요';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요';
  if (code === '23505') return '이미 있는 이름입니다';
  if (code === '42P01' || /relation .* does not exist|Could not find the table/i.test(msg)) {
    return 'characters 테이블이 없습니다. supabase/migrations의 SQL을 먼저 실행해 주세요';
  }
  return msg;
}

function rowToSave(row) {
  return {
    id: row.user_id,
    name: row.name,
    classId: row.class_id,
    level: row.level,
    exp: row.exp,
    gold: row.gold,
    data: row.data,
    createdAt: row.created_at,
  };
}

export class Session {
  constructor(game) {
    this.game = game;
    const forceOffline = new URLSearchParams(window.location.search).has('offline');
    this.mode = supabase && !forceOffline ? 'online' : 'offline';
    this.configError = supabaseConfigError;
    this.user = null; // { id, email }
    this.character = null;
    this._authSub = null;
  }

  get isOnline() {
    return this.mode === 'online';
  }

  /** 저장된 로그인을 확인한다. → { mode, user } */
  async init() {
    if (this.isOnline) {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.warn('[저장] 세션 확인 실패', error);
      const u = data && data.session ? data.session.user : null;
      this.user = u ? { id: u.id, email: u.email } : null;
      if (!this._authSub) {
        this._authSub = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT') {
            this.user = null;
            this.game.events.emit('auth:changed', { user: null });
          } else if (session && session.user && (!this.user || this.user.id !== session.user.id)) {
            this.user = { id: session.user.id, email: session.user.email };
            this.game.events.emit('auth:changed', { user: this.user });
          }
        });
      }
    }
    this.game.events.emit('session:ready', { mode: this.mode, user: this.user });
    return { mode: this.mode, user: this.user };
  }

  // ---------- 온라인 로그인

  async signUp(email, password) {
    if (!this.isOnline) return { ok: false, error: '오프라인 모드에서는 가입이 필요 없습니다' };
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) return { ok: false, error: koreanError(error) };
    if (!data.session) {
      return { ok: false, needsConfirm: true, error: '확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요' };
    }
    this.user = { id: data.user.id, email: data.user.email };
    this.game.events.emit('auth:changed', { user: this.user });
    return { ok: true, user: this.user };
  }

  async signIn(email, password) {
    if (!this.isOnline) return { ok: false, error: '오프라인 모드입니다' };
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, error: koreanError(error) };
    this.user = { id: data.user.id, email: data.user.email };
    this.game.events.emit('auth:changed', { user: this.user });
    return { ok: true, user: this.user };
  }

  // ---------- 오프라인 로그인 (이름만)

  offlineProfiles() {
    const list = lsGet(LS.profiles, []);
    return Array.isArray(list) ? list : [];
  }

  lastOfflineProfile() {
    return lsGet(LS.last, null);
  }

  async signInOffline(profile) {
    const name = String(profile || '').trim();
    if (!NAME_RULE.test(name)) return { ok: false, error: NAME_RULE_TEXT };
    const profiles = this.offlineProfiles();
    if (!profiles.includes(name)) lsSet(LS.profiles, [...profiles, name]);
    lsSet(LS.last, name);
    this.user = { id: `offline:${name}`, email: null, profile: name };
    this.game.events.emit('auth:changed', { user: this.user });
    return { ok: true, user: this.user };
  }

  async signOut() {
    await this.game.leaveWorld();
    this.character = null;
    if (this.isOnline) await supabase.auth.signOut();
    this.user = null;
    this.game.events.emit('auth:changed', { user: null });
  }

  // ---------- 캐릭터

  /** 내 캐릭터를 불러온다. 없으면 null */
  async loadCharacter() {
    if (!this.user) return { ok: false, error: '로그인이 필요합니다' };
    let save = null;
    if (this.isOnline) {
      const { data, error } = await supabase.from('characters').select('*').eq('user_id', this.user.id).maybeSingle();
      if (error) return { ok: false, error: koreanError(error) };
      save = data ? rowToSave(data) : null;
    } else {
      save = lsGet(LS.char(this.user.profile), null);
    }
    this.character = save ? new Character(save, this.game.data, this.game.events) : null;
    return { ok: true, character: this.character };
  }

  async createCharacter(name, classId = null) {
    if (!this.user) return { ok: false, error: '로그인이 필요합니다' };
    const clean = String(name || '').trim();
    if (!NAME_RULE.test(clean)) return { ok: false, error: NAME_RULE_TEXT };
    const data = this.game.data;
    const save = Character.newSave({ id: this.user.id, name: clean, classId: classId ?? data.defaultClassId }, data);
    if (this.isOnline) {
      const { data: row, error } = await supabase
        .from('characters')
        .insert({
          user_id: this.user.id,
          name: save.name,
          class_id: save.classId,
          level: save.level,
          exp: save.exp,
          gold: save.gold,
          data: save.data,
        })
        .select()
        .single();
      if (error) return { ok: false, error: koreanError(error) };
      this.character = new Character(rowToSave(row), data, this.game.events);
    } else {
      if (!lsSet(LS.char(this.user.profile), save)) return { ok: false, error: '이 브라우저에 저장할 수 없습니다' };
      this.character = new Character(save, data, this.game.events);
    }
    return { ok: true, character: this.character };
  }

  /** SaveManager가 부른다 */
  async saveCharacter(save) {
    if (!this.user) return { ok: false, error: '로그인이 필요합니다' };
    if (this.isOnline) {
      const { error } = await supabase
        .from('characters')
        .update({
          class_id: save.classId,
          level: save.level,
          exp: save.exp,
          gold: save.gold,
          data: save.data,
        })
        .eq('user_id', this.user.id);
      if (error) return { ok: false, error: koreanError(error) };
      return { ok: true };
    }
    return lsSet(LS.char(this.user.profile), save) ? { ok: true } : { ok: false, error: '이 브라우저에 저장할 수 없습니다' };
  }
}
