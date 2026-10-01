export function getCorporacaoApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://corporacao-api.agendaproapp.com/corporacao';
  }
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'https://corporacao-api.agendaproapp.com/corporacao';
  }
  return 'https://corporacao-api.agendaproapp.com/corporacao';
}
