import axios from 'axios';
import { supabase } from '@/integrations/supabase/client';
import { getCorporacaoApiBaseUrl } from './apiUrl';

let _api: ReturnType<typeof axios.create> | null = null;

function getApi() {
  if (_api) return _api;

  _api = axios.create({
    baseURL: getCorporacaoApiBaseUrl(),
    headers: { 'Content-Type': 'application/json' },
  });

  _api.interceptors.request.use(async (config) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  _api.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      if (status === 401) console.error('[API] Token inválido ou expirado');
      else if (status === 429) console.error('[API] Rate limit atingido');
      else if (status >= 500) console.error('[API] Erro no servidor:', message);
      return Promise.reject(new Error(message));
    },
  );

  return _api;
}

export default { post: (...args: Parameters<ReturnType<typeof axios.create>['post']>) => getApi().post(...args) };
