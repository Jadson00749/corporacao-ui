# Acesso ao Servidor — VPS Corporação (Lucas)

## VPS do Cliente (HostGator)

| Campo | Valor |
|---|---|
| **IP** | `143.95.173.98` |
| **Porta SSH** | `22022` |
| **Usuário** | `root` |
| **SO** | Ubuntu 22.04 |
| **RAM** | 2 GB |
| **Disco** | 50 GB |
| **Localização** | São Paulo, Brasil |

**Painel de gerenciamento:** cliente.hostgator.com.br → VPS e Dedicados

---

## Conectar via terminal

```bash
ssh root@143.95.173.98 -p 22022
```

---

## VPS da Plataforma (Jadson — srv1390186)

| Campo | Valor |
|---|---|
| **IP** | `31.97.175.232` |
| **Usuário** | `root` |

```bash
ssh root@31.97.175.232
```

---

## Containers em produção (VPS Jadson)

```bash
# Ver todos os containers rodando
docker ps

# Logs em tempo real da API da Corporação
docker logs <container_id> -f

# Logs das últimas linhas
docker logs <container_id> --tail 50
```

---

## URLs da API em produção

| Ambiente | URL |
|---|---|
| **Swagger (docs)** | https://api.d3data.com.br/corporacao/docs |
| **Base URL** | https://api.d3data.com.br/corporacao |
| **Local (dev)** | http://localhost:3001/corporacao/docs |

> DNS: subdomínio `api.d3data.com.br` → A record `143.95.173.98` (domínio de Matheus, gerenciado no HostGator)

---

## Deploy do backend (corporacao-nest-apis)

**1. Local — build e push para Docker Hub:**
```powershell
.\build.ps1 -env prd -version vX
```

**2. VPS Lucas — atualizar container:**
```bash
cd /opt/corporacao-prd && docker compose pull nest-api && docker compose up -d --force-recreate nest-api
```

---

## Credenciais Asaas (produção)

> ⚠️ Nunca armazene aqui. Cadastrar diretamente no banco via Supabase dashboard.
> Ver: `src/doc/README.md` → seção "Como cadastrar no banco"
