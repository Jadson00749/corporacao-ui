# ==============================================
# BUILD SCRIPT — Corporação UI Front
# Uso: .\build.ps1 -env hml -version v1
#      .\build.ps1 -env prd -version v1
# ==============================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("hml","prd")]
    [string]$env,

    [Parameter(Mandatory=$true)]
    [string]$version
)

$envFile = ".env"
$imageName = "jadson07/corporacao-ui"
$tag = "${imageName}:${version}-${env}"

if (-not (Test-Path $envFile)) {
    Write-Host "Arquivo $envFile nao encontrado!" -ForegroundColor Red
    exit 1
}

# Carrega as variaveis do arquivo .env
$envVars = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^(?<key>[^#][^=]+)=(?<value>.+)$") {
        $envVars[$Matches.key.Trim()] = $Matches.value.Trim().Trim('"')
    }
}

Write-Host "--- Ambiente: $env | Versao: $version ---" -ForegroundColor Cyan
Write-Host "--- Image: $tag ---" -ForegroundColor Cyan

# Build com as variaveis do ambiente
docker build --no-cache `
    --build-arg VITE_SUPABASE_PROJECT_ID=$($envVars['VITE_SUPABASE_PROJECT_ID']) `
    --build-arg VITE_SUPABASE_URL=$($envVars['VITE_SUPABASE_URL']) `
    --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=$($envVars['VITE_SUPABASE_PUBLISHABLE_KEY']) `
    --build-arg VITE_CORPORACAO_API_URL=$($envVars['VITE_CORPORACAO_API_URL']) `
    -t $tag `
    .

if ($LASTEXITCODE -ne 0) {
    Write-Host "--- BUILD FALHOU ---" -ForegroundColor Red
    exit 1
}

Write-Host "--- PUSH: Enviando para Docker Hub ---" -ForegroundColor Cyan
docker push $tag

if ($LASTEXITCODE -ne 0) {
    Write-Host "--- PUSH FALHOU ---" -ForegroundColor Red
    exit 1
}

Write-Host "--- CONCLUIDO: $tag disponivel no Docker Hub ---" -ForegroundColor Green
