import { createClient } from '@supabase/supabase-js';

// Safe environment variable retriever
const getEnv = (key: string): string => {
  // 1. Try Vite standard (import.meta.env)
  try {
    // @ts-ignore
    if (import.meta?.env) {
      // @ts-ignore
      const viteVal = import.meta.env[`VITE_${key}`];
      if (viteVal) return viteVal;
      // @ts-ignore
      const plainVal = import.meta.env[key];
      if (plainVal) return plainVal;
    }
  } catch (e) {
    // Ignore errors if import.meta is not available
  }

  // 2. Try global process.env (Standard Node/CRA)
  try {
    if (typeof process !== 'undefined' && process.env) {
      const viteVal = process.env[`VITE_${key}`];
      if (viteVal) return viteVal;
      
      const reactVal = process.env[`REACT_APP_${key}`];
      if (reactVal) return reactVal;
      
      const plainVal = process.env[key];
      if (plainVal) return plainVal;
    }
  } catch (e) {
    // Ignore errors
  }

  // 3. Fallback to window object if manually injected
  try {
    // @ts-ignore
    if (typeof window !== 'undefined' && window.env) {
      // @ts-ignore
      return window.env[key] || '';
    }
  } catch (e) {}

  return '';
};

const rawUrl = getEnv('SUPABASE_URL');
const rawKey = getEnv('SUPABASE_ANON_KEY');

const supabaseUrl = rawUrl || 'https://placeholder.supabase.co';
const supabaseKey = rawKey || 'placeholder';

// Check if configured correctly (must have URL and not be placeholder)
export const isConfigured = 
  !!rawUrl && 
  !!rawKey && 
  rawUrl.length > 0 && 
  !rawUrl.includes('placeholder');

export const supabase = createClient(supabaseUrl, supabaseKey);