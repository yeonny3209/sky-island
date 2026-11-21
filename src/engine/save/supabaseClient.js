// Supabase 클라이언트. .env의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY(또는 VITE_SUPABASE_PUBLISHABLE_KEY)로 만든다.
// 값이 없으면 null → 엔진은 오프라인 모드(이 브라우저에만 저장, 탭끼리 멀티)로 돈다.
// service_role(비밀) 키가 들어오면 쓰지 않고 오류를 띄운다.

import { createClient } from '@supabase/supabase-js';

const env = import.meta.env;
const url = String(env.VITE_SUPABASE_URL || '').trim();
const key = String(env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

function isSecretKey(k) {
  if (k.startsWith('sb_secret_')) return true;
  const parts = k.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.role === 'service_role';
    } catch {
      return false;
    }
  }
  return false;
}

export let supabaseConfigError = null;
let client = null;

if (url && key) {
  if (isSecretKey(key)) {
    supabaseConfigError = '.env에 service_role(비밀) 키가 들어 있습니다. anon 또는 publishable 키로 바꾸세요. 오프라인 모드로 실행합니다.';
    console.error(`[저장] ${supabaseConfigError}`);
  } else {
    try {
      client = createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    } catch (err) {
      supabaseConfigError = `Supabase 연결 설정이 잘못되었습니다: ${err.message}`;
      console.error(`[저장] ${supabaseConfigError}`);
    }
  }
}

export const supabase = client;
