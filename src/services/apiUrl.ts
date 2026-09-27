export function getCorporacaoApiBaseUrl(): string {
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/corporacao';
  }
  return 'https://corporacao-api.agendaproapp.com/corporacao';
}
