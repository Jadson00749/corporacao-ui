export function getCorporacaoApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://api.d3data.com.br/corporacao';
  }
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3001/corporacao';
  }
  return 'https://api.d3data.com.br/corporacao';
}
