// Ações de otimização do Windows (PowerShell; o agente já roda como administrador).
// Ajustes de configuração guardam o valor anterior em %ProgramData%\GSTI-Diagnostico\ajustes.json
// e podem ser desfeitos pela ação "desfazer-ajustes".

const UTIL = String.raw`
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"
function Tam($p) { $s = (Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum; if ($s) { [long]$s } else { 0 } }
function Livre() { [long](Get-PSDrive ($env:SystemDrive.TrimEnd(":"))).Free }
function Resultado($bytes, $detalhe) { "GSTI_RESULTADO " + (@{ liberadoBytes = [long]$bytes; detalhe = $detalhe } | ConvertTo-Json -Compress) }

# --- Ajustes reversíveis ---
$ArqAjustes = if ($env:GSTI_AJUSTES_ARQUIVO) { $env:GSTI_AJUSTES_ARQUIVO } else { Join-Path $env:ProgramData "GSTI-Diagnostico\ajustes.json" }
# No PowerShell 5.1 o ConvertFrom-Json devolve a lista inteira como um único objeto: o ForEach desenrola
function LerAjustes {
  $lista = New-Object System.Collections.ArrayList
  if (Test-Path -LiteralPath $ArqAjustes) {
    $dados = Get-Content -LiteralPath $ArqAjustes -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($item in @($dados | ForEach-Object { $_ })) { [void]$lista.Add($item) }
  }
  return ,$lista
}
function GravarAjustes($lista) {
  New-Item -ItemType Directory -Force -Path (Split-Path $ArqAjustes) | Out-Null
  ConvertTo-Json -InputObject @($lista) -Depth 4 | Set-Content -LiteralPath $ArqAjustes -Encoding UTF8
}
# Guarda o estado original (só na primeira vez) e aplica o novo valor no registro
function Definir($caminho, $nome, $valor, $tipo) {
  $lista = LerAjustes
  if (-not ($lista | Where-Object { $_.caminho -eq $caminho -and $_.nome -eq $nome })) {
    $existia = $false; $anterior = $null; $tipoAnterior = $null
    if (Test-Path -LiteralPath $caminho) {
      $item = Get-Item -LiteralPath $caminho
      if ($item.GetValueNames() -contains $nome) {
        $existia = $true
        $anterior = $item.GetValue($nome, $null, "DoNotExpandEnvironmentNames")
        $tipoAnterior = $item.GetValueKind($nome).ToString()
        if ($anterior -is [byte[]]) { $anterior = [Convert]::ToBase64String($anterior) }
      }
    }
    [void]$lista.Add([pscustomobject]@{ caminho = $caminho; nome = $nome; existia = $existia; valor = $anterior; tipo = $tipoAnterior })
    GravarAjustes $lista
  }
  if (-not (Test-Path -LiteralPath $caminho)) { New-Item -Path $caminho -Force | Out-Null }
  New-ItemProperty -LiteralPath $caminho -Name $nome -Value $valor -PropertyType $tipo -Force -ErrorAction Stop | Out-Null
}
# Estados que não são registro (plano de energia, hibernação)
function GuardarEstado($chave, $valor) {
  $lista = LerAjustes
  if (-not ($lista | Where-Object { $_.caminho -eq $chave })) {
    [void]$lista.Add([pscustomobject]@{ caminho = $chave; nome = ""; existia = $true; valor = $valor; tipo = "estado" })
    GravarAjustes $lista
  }
}
function EhNotebook { (Get-CimInstance Win32_ComputerSystem).PCSystemType -eq 2 }
`;

const WINDOWS = [
  // ----- Manutenção -----
  {
    id: "ponto-restauracao", categoria: "manutencao", nome: "Criar ponto de restauração", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Permite desfazer as mudanças do sistema pela Restauração do Windows. Recomendado antes das demais ações.",
    script: String.raw`
try {
  Checkpoint-Computer -Description "GSTI Diagnostico - antes da otimizacao" -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
  Resultado 0 "Ponto de restauração criado."
} catch {
  Resultado 0 ("Não foi possível criar o ponto: " + $_.Exception.Message + " (a Proteção do Sistema pode estar desativada ou já houve um ponto nas últimas 24 h).")
}`,
  },
  {
    id: "otimizar-unidades", categoria: "manutencao", nome: "Otimizar unidade do sistema (TRIM/desfragmentação)", risco: "baixo", admin: true, lento: true, padrao: true,
    descricao: "SSD: envia TRIM. HD: desfragmenta. O Windows escolhe o método conforme o tipo do disco.",
    script: String.raw`
$letra = $env:SystemDrive.TrimEnd(":")
Optimize-Volume -DriveLetter $letra -ErrorAction Stop
Resultado 0 "Unidade $letra otimizada."`,
  },
  {
    id: "dns", categoria: "manutencao", nome: "Limpar cache de DNS", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Resolve sites que não abrem por endereço antigo em cache.",
    script: String.raw`
Clear-DnsClientCache
Resultado 0 "Cache de DNS limpo."`,
  },
  {
    id: "sfc", categoria: "manutencao", nome: "Verificar e reparar arquivos do sistema (SFC)", risco: "baixo", admin: true, lento: true, padrao: false,
    descricao: "Verifica arquivos protegidos do Windows e repara os corrompidos. Leva de 10 a 30 minutos.",
    script: String.raw`
& sfc.exe /scannow | Out-Null
$codigo = $LASTEXITCODE
$msg = switch ($codigo) { 0 { "Nenhuma violação de integridade encontrada ou problemas reparados." } 1 { "Arquivos corrompidos foram reparados." } default { "SFC terminou com código $codigo (veja CBS.log)." } }
Resultado 0 $msg`,
  },

  // ----- Limpeza -----
  {
    id: "temporarios", categoria: "limpeza", nome: "Limpar arquivos temporários", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Apaga arquivos temporários do usuário e do Windows com mais de 1 dia (arquivos em uso são mantidos).",
    script: String.raw`
$antes = Livre
$limite = (Get-Date).AddDays(-1)
foreach ($p in @($env:TEMP, "$env:SystemRoot\Temp")) {
  Get-ChildItem -LiteralPath $p -Recurse -Force -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $limite } | Remove-Item -Force -ErrorAction SilentlyContinue
  Get-ChildItem -LiteralPath $p -Recurse -Force -Directory -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Where-Object { -not (Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue) } | Remove-Item -Force -ErrorAction SilentlyContinue
}
Resultado ([Math]::Max(0, (Livre) - $antes)) "Temporários removidos."`,
  },
  {
    id: "miniaturas", categoria: "limpeza", nome: "Limpar cache de miniaturas", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Remove o cache de miniaturas do Explorador; o Windows recria conforme as pastas são abertas.",
    script: String.raw`
$pasta = "$env:LOCALAPPDATA\Microsoft\Windows\Explorer"
$antes = Tam $pasta
Get-ChildItem -LiteralPath $pasta -Filter "thumbcache_*.db" -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Resultado ([Math]::Max(0, $antes - (Tam $pasta))) "Arquivos em uso pelo Explorador são mantidos."`,
  },
  {
    id: "cache-windows-update", categoria: "limpeza", nome: "Limpar downloads do Windows Update", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Remove instaladores de atualizações já baixados (o Windows baixa de novo se precisar).",
    script: String.raw`
$pasta = "$env:SystemRoot\SoftwareDistribution\Download"
$antes = Tam $pasta
Stop-Service -Name wuauserv, bits -Force -ErrorAction SilentlyContinue
Get-ChildItem -LiteralPath $pasta -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Start-Service -Name bits, wuauserv -ErrorAction SilentlyContinue
Resultado ([Math]::Max(0, $antes - (Tam $pasta))) "Cache do Windows Update limpo."`,
  },
  {
    id: "relatorios-erro", categoria: "limpeza", nome: "Limpar relatórios de erro e despejos de memória", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Remove relatórios do Windows Error Reporting, minidumps e MEMORY.DMP (os erros já ficam registrados no laudo).",
    script: String.raw`
$antes = Livre
foreach ($p in @("$env:ProgramData\Microsoft\Windows\WER\ReportArchive", "$env:ProgramData\Microsoft\Windows\WER\ReportQueue", "$env:LOCALAPPDATA\CrashDumps", "$env:SystemRoot\Minidump")) {
  Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}
Remove-Item -LiteralPath "$env:SystemRoot\MEMORY.DMP" -Force -ErrorAction SilentlyContinue
Resultado ([Math]::Max(0, (Livre) - $antes)) "Relatórios de erro e despejos removidos."`,
  },
  {
    id: "cache-navegadores", categoria: "limpeza", nome: "Limpar cache dos navegadores", risco: "baixo", admin: false, lento: false, padrao: false,
    descricao: "Chrome, Edge e Firefox: só o cache (não apaga senhas, histórico, favoritos nem logins). Os navegadores precisam estar fechados.",
    script: String.raw`
$abertos = @(Get-Process -Name chrome, msedge, firefox -ErrorAction SilentlyContinue)
if ($abertos.Count) { Resultado 0 "Navegadores abertos: feche Chrome, Edge e Firefox e execute de novo."; exit 0 }
$pastas = @()
foreach ($base in @("$env:LOCALAPPDATA\Google\Chrome\User Data", "$env:LOCALAPPDATA\Microsoft\Edge\User Data")) {
  Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $pastas += Join-Path $_.FullName "Cache"; $pastas += Join-Path $_.FullName "Code Cache"; $pastas += Join-Path $_.FullName "GPUCache"
  }
}
Get-ChildItem -LiteralPath "$env:LOCALAPPDATA\Mozilla\Firefox\Profiles" -Directory -ErrorAction SilentlyContinue | ForEach-Object { $pastas += Join-Path $_.FullName "cache2" }
$liberado = 0
foreach ($p in $pastas) { if (Test-Path -LiteralPath $p) { $t = Tam $p; Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; $liberado += [Math]::Max(0, $t - (Tam $p)) } }
Resultado $liberado "Cache dos navegadores limpo."`,
  },
  {
    id: "componentes", categoria: "limpeza", nome: "Limpeza de componentes do Windows (DISM)", risco: "baixo", admin: true, lento: true, padrao: false,
    descricao: "Remove versões antigas de componentes substituídos por atualizações. Pode levar de 5 a 20 minutos.",
    script: String.raw`
$antes = Livre
& Dism.exe /Online /Cleanup-Image /StartComponentCleanup /NoRestart | Out-Null
$codigo = $LASTEXITCODE
Resultado ([Math]::Max(0, (Livre) - $antes)) ($(if ($codigo -eq 0) { "Limpeza de componentes concluída." } else { "DISM terminou com código $codigo." }))
if ($codigo -ne 0) { exit 1 }`,
  },

  // ----- Desempenho e aparência (reversíveis) -----
  {
    id: "efeitos-visuais", categoria: "desempenho", nome: "Efeitos visuais para melhor desempenho", risco: "baixo", admin: false, lento: false, padrao: true, reinicio: true,
    descricao: "Desliga animações, transparência, sombras e Aero Peek e reduz o atraso dos menus. Mantém fontes suavizadas e miniaturas. Aplica ao sair e entrar na conta.",
    script: String.raw`
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" "VisualFXSetting" 3 DWord
Definir "HKCU:\Control Panel\Desktop" "UserPreferencesMask" ([byte[]](0x90,0x12,0x03,0x80,0x10,0x00,0x00,0x00)) Binary
Definir "HKCU:\Control Panel\Desktop" "MenuShowDelay" "100" String
Definir "HKCU:\Control Panel\Desktop\WindowMetrics" "MinAnimate" "0" String
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "TaskbarAnimations" 0 DWord
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "ListviewShadow" 0 DWord
Definir "HKCU:\Software\Microsoft\Windows\DWM" "EnableAeroPeek" 0 DWord
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" "EnableTransparency" 0 DWord
Resultado 0 "Efeitos visuais ajustados (saia e entre na conta para aplicar tudo)."`,
  },
  {
    id: "sugestoes-anuncios", categoria: "desempenho", nome: "Desativar sugestões, anúncios e apps instalados automaticamente", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Impede o Windows de instalar apps patrocinados e mostrar dicas, sugestões e anúncios no Iniciar, no Explorador e na tela de bloqueio.",
    script: String.raw`
$cdm = "HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager"
foreach ($n in @("SilentInstalledAppsEnabled", "SystemPaneSuggestionsEnabled", "SoftLandingEnabled", "PreInstalledAppsEnabled", "OemPreInstalledAppsEnabled", "RotatingLockScreenOverlayEnabled", "SubscribedContent-338387Enabled", "SubscribedContent-338388Enabled", "SubscribedContent-338389Enabled", "SubscribedContent-353694Enabled", "SubscribedContent-353696Enabled")) {
  Definir $cdm $n 0 DWord
}
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "ShowSyncProviderNotifications" 0 DWord
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" "Start_IrisRecommendations" 0 DWord
Resultado 0 "Sugestões e instalações automáticas desativadas."`,
  },
  {
    id: "game-dvr", categoria: "desempenho", nome: "Desativar gravação de jogos em segundo plano (Xbox Game Bar)", risco: "baixo", admin: false, lento: false, padrao: false,
    descricao: "Libera CPU/GPU em jogos e programas gráficos. O cliente perde a gravação automática de clipes (pode reativar no Windows).",
    script: String.raw`
Definir "HKCU:\System\GameConfigStore" "GameDVR_Enabled" 0 DWord
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\GameDVR" "AppCaptureEnabled" 0 DWord
Resultado 0 "Gravação em segundo plano desativada."`,
  },
  {
    id: "gpu-hardware", categoria: "desempenho", nome: "Agendamento de GPU acelerado por hardware", risco: "baixo", admin: true, lento: false, padrao: false, reinicio: true,
    descricao: "Reduz latência e uso de CPU em placas de vídeo compatíveis (NVIDIA GTX 10+, AMD RX 5000+, Intel recente). Exige reiniciar.",
    script: String.raw`
Definir "HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers" "HwSchMode" 2 DWord
Resultado 0 "Ativado; reinicie o computador. Sem suporte da placa, o Windows ignora o ajuste."`,
  },
  {
    id: "plano-energia", categoria: "desempenho", nome: "Plano de energia de alto desempenho (desktops)", risco: "baixo", admin: true, lento: false, padrao: false,
    descricao: "Mantém o processador sem economia de energia. Em notebooks é ignorado para não reduzir a bateria.",
    script: String.raw`
if (EhNotebook) { Resultado 0 "Notebook: mantido o plano atual para preservar a bateria."; exit 0 }
$atual = ((powercfg /getactivescheme) -join " " | Select-String -Pattern "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}").Matches[0].Value
$lista = (powercfg /list) -join " "
$alvo = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c"
if ($lista -notmatch $alvo) {
  $novo = ((powercfg -duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61) -join " " | Select-String -Pattern "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}").Matches
  if ($novo.Count) { $alvo = $novo[0].Value } else { Resultado 0 "Este Windows não tem plano de alto desempenho disponível."; exit 0 }
}
GuardarEstado "powercfg:plano" $atual
powercfg /setactive $alvo
Resultado 0 "Plano de alto desempenho ativado."`,
  },
  {
    id: "apps-segundo-plano", categoria: "desempenho", nome: "Impedir apps da Loja em segundo plano", risco: "baixo", admin: true, lento: false, padrao: false,
    descricao: "Economiza memória e CPU. Atenção: apps da Microsoft Store (ex.: WhatsApp da Loja, Teams novo) deixam de notificar com a janela fechada.",
    script: String.raw`
Definir "HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy" "LetAppsRunInBackground" 2 DWord
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" "GlobalUserDisabled" 1 DWord
Resultado 0 "Apps da Loja não rodam mais em segundo plano."`,
  },
  {
    id: "barra-tarefas", categoria: "desempenho", nome: "Barra de tarefas mais leve (widgets, notícias e Copilot)", risco: "baixo", admin: false, lento: false, padrao: false,
    descricao: "Remove widgets/notícias e o botão do Copilot e deixa a pesquisa como ícone. Menos processos rodando e barra mais limpa.",
    script: String.raw`
$adv = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
$avisos = @()
try { Definir $adv "TaskbarDa" 0 DWord } catch { $avisos += "widgets (bloqueado pelo Windows nesta versão)" }
Definir $adv "ShowCopilotButton" 0 DWord
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\Feeds" "ShellFeedsTaskbarViewMode" 2 DWord
Definir "HKCU:\Software\Microsoft\Windows\CurrentVersion\Search" "SearchboxTaskbarMode" 1 DWord
Resultado 0 ("Barra de tarefas ajustada." + $(if ($avisos.Count) { " Não alterado: " + ($avisos -join ", ") + "." } else { "" }))`,
  },
  {
    id: "hibernacao", categoria: "desempenho", nome: "Desativar hibernação (libera o hiberfil.sys)", risco: "baixo", admin: true, lento: false, padrao: false,
    descricao: "Libera espaço igual a cerca de 40% da memória RAM. Desativa a hibernação e a Inicialização Rápida (reversível).",
    script: String.raw`
$antes = Livre
GuardarEstado "powercfg:hibernacao" "on"
powercfg /hibernate off
Resultado ([Math]::Max(0, (Livre) - $antes)) "Hibernação desativada."`,
  },

  // ----- Apagam dados ou removem programas -----
  {
    id: "lixeira", categoria: "limpeza", nome: "Esvaziar a Lixeira", risco: "medio", admin: false, lento: false, padrao: false,
    descricao: "Apaga definitivamente os arquivos da Lixeira. Só marque com autorização do cliente.",
    script: String.raw`
$antes = Livre
Clear-RecycleBin -Force -ErrorAction SilentlyContinue
Resultado ([Math]::Max(0, (Livre) - $antes)) "Lixeira esvaziada."`,
  },
  {
    id: "apps-patrocinados", categoria: "desempenho", nome: "Remover apps patrocinados pré-instalados", risco: "medio", admin: true, lento: false, padrao: false,
    descricao: "Remove jogos e apps promocionais (Candy Crush e outros da King, Solitaire com anúncios, 3D Viewer, Mixed Reality, Bing Finanças/Esportes). Reinstaláveis pela Microsoft Store.",
    script: String.raw`
$padroes = @("*king.com*", "*CandyCrush*", "*BubbleWitch*", "*MarchofEmpires*", "Microsoft.MicrosoftSolitaireCollection", "Microsoft.Microsoft3DViewer", "Microsoft.3DBuilder", "Microsoft.MixedReality.Portal", "Microsoft.BingFinance", "Microsoft.BingSports")
$removidos = @()
foreach ($p in $padroes) {
  Get-AppxPackage -AllUsers -Name $p -ErrorAction SilentlyContinue | ForEach-Object { Remove-AppxPackage -Package $_.PackageFullName -AllUsers -ErrorAction SilentlyContinue; $removidos += $_.Name }
  Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like $p } | ForEach-Object { Remove-AppxProvisionedPackage -Online -PackageName $_.PackageName -ErrorAction SilentlyContinue | Out-Null }
}
$lista = @($removidos | Select-Object -Unique)
Resultado 0 ($(if ($lista.Count) { "Removidos: " + ($lista -join ", ") } else { "Nenhum app patrocinado encontrado." }))`,
  },

  // ----- Desfazer -----
  {
    id: "desfazer-ajustes", categoria: "reverter", nome: "Desfazer ajustes de desempenho do GSTI Diagnóstico", risco: "baixo", admin: true, lento: false, padrao: false, reinicio: true,
    descricao: "Volta os valores originais de todos os ajustes feitos pelo agente neste computador (efeitos visuais, energia, barra de tarefas, hibernação...). Apps removidos não voltam.",
    script: String.raw`
$lista = LerAjustes
if (-not $lista.Count) { Resultado 0 "Nenhum ajuste do GSTI Diagnóstico registrado neste computador."; exit 0 }
foreach ($a in $lista) {
  if ($a.tipo -eq "estado") {
    if ($a.caminho -eq "powercfg:plano" -and $a.valor) { powercfg /setactive $a.valor }
    if ($a.caminho -eq "powercfg:hibernacao") { powercfg /hibernate on }
  } elseif ($a.existia) {
    $v = $a.valor
    if ($a.tipo -eq "Binary") { $v = [Convert]::FromBase64String($v) }
    New-ItemProperty -LiteralPath $a.caminho -Name $a.nome -Value $v -PropertyType $a.tipo -Force | Out-Null
  } else {
    Remove-ItemProperty -LiteralPath $a.caminho -Name $a.nome -ErrorAction SilentlyContinue
  }
}
Remove-Item -LiteralPath $ArqAjustes -Force
Resultado 0 ("Restaurados " + $lista.Count + " ajuste(s). Saia e entre na conta (ou reinicie) para aplicar.")`,
  },
];

module.exports = { UTIL, ACOES: WINDOWS };
