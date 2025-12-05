import { createClient } from '@supabase/supabase-js';

// Helper to safely get env vars from various sources (Vite, React Scripts, or standard process.env)
const getEnvVar = (key: string) => {
  // Check standard process.env (Node/CRA)
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Check Vite specific prefix
  if (typeof process !== 'undefined' && process.env && process.env[`VITE_${key}`]) {
    return process.env[`VITE_${key}`];
  }
  // Check React App specific prefix
  if (typeof process !== 'undefined' && process.env && process.env[`REACT_APP_${key}`]) {
    return process.env[`REACT_APP_${key}`];
  }
  // Check import.meta.env (Vite standard) - intentionally using string access to avoid TS errors in non-module context
  try {
    // @ts-ignore
    if (import.meta && import.meta.env && import.meta.env[`VITE_${key}`]) {
      // @ts-ignore
      return import.meta.env[`VITE_${key}`];
    }
  } catch (e) {
    // ignore
  }
  
  return '';
};

const rawUrl = getEnvVar('SUPABASE_URL');
const rawKey = getEnvVar('SUPABASE_ANON_KEY');

const supabaseUrl = rawUrl || 'https://placeholder.supabase.co';
const supabaseKey = rawKey || 'placeholder';

// Check if the variables are actually present for UI logic
export const isConfigured = 
  !!rawUrl && 
  !!rawKey && 
  rawUrl.length > 0 && 
  !rawUrl.includes('placeholder');

if (!isConfigured) {
  console.warn("Supabase is not configured. Environment variables missing.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);