# GSTI Diagnóstico — agente portátil, laudos, otimização e pós-formatação

Módulo vendável **Diagnóstico** (chave `diagnostico`). O técnico roda o agente a partir de um
pen drive no computador do cliente (**Windows, macOS ou Linux**), gera o **laudo técnico**,
executa a **otimização** e a **pós-formatação** (drivers e programas) autorizadas pelo cliente e
anexa os laudos à **OS** no GSTI App, na
entrada e na saída do reparo (com comparativo antes/depois).

## Peças

| Arquivo | Onde roda | Função |
|---|---|---|
| `coleta.js` | agente | Escolhe o coletor do sistema e devolve as seções do laudo |
| `coleta-windows.js` | agente | PowerShell/CIM (só leitura): hardware, sistema, SMART, volumes, bateria (`powercfg`), temperaturas, ativação, antivírus, rede, eventos |
| `coleta-macos.js` | agente | `system_profiler` (hardware, memória, armazenamento com SMART, vídeo, bateria), `sw_vers`, boot e pânicos do kernel |
| `coleta-linux.js` | agente | `/proc`, `/sys`, `lscpu`, `lsblk`, `df`, `lspci`, `journalctl` e, com root, `smartctl` e `dmidecode` |
| `testes-rapidos.js` | agente | Gravação no disco (256 MB com fsync, apagado ao final), internet (DNS, latência, download de 10 MB) e uso de CPU |
| `otimizacao.js` | agente | Catálogo de ações por sistema, scripts da assistência e execução com registro |
| `drivers.js` | agente | Leitura de INF, índice do repositório/backup, comparação de versões e plano de instalação |
| `drivers-windows.js` | agente | Inventário de dispositivos, backup (`pnputil /export-driver`), instalação de INF, Windows Update e ferramentas Dell/Lenovo/HP |
| `programas.js` | agente | Catálogo de programas (winget, Homebrew, Flathub), `programas.json` da assistência e instalação |
| `verificar-catalogo.js` | CI | Confere se os IDs do catálogo existem na fonte oficial do sistema |
| `laudo.js` | agente e app | Formato `gsti-laudo` v1, alertas, situação, integridade (sha256), comparação, resumo |
| `laudo-html.js` | agente e app | Laudo e comparativo em HTML A4 (visualizar e gerar PDF) |
| `rede-local.js` | agente e app | Descoberta por UDP (porta 47851) e envio HTTP com código de 6 dígitos |
| `cli.js` | terminal/CI | Diagnóstico sem interface: `node diagnostico/cli.js --saida laudo.gstilaudo` |
| `agente/` | agente | Electron portátil (interface em HTML/JS puro) |
| `../laudos-os.js` | app | Tabela `os_laudos`, importar, receber pela rede, PDFs e download do agente |

## Uso

1. No GSTI App: **OS → ícone de laudos → Baixar GSTI Diagnóstico → sistema** (salva no pen
   drive) — ou pela área do cliente no site.
2. No computador do cliente, abrir o agente:
   - **Windows**: `GSTI-Diagnostico-x.y.z-windows-x64.exe` (pede administrador).
   - **macOS**: descompactar o `.zip` e abrir o app com **botão direito → Abrir** na primeira vez
     (o agente ainda não é assinado pela Apple). Ações de administrador pedem a senha.
   - **Linux**: `chmod +x GSTI-Diagnostico-*.AppImage` e executar; para SMART, rodar com `sudo`
     e ter `smartmontools` instalado. Ações de administrador pedem a senha (pkexec).
3. **Entrada** → **Iniciar diagnóstico** → enviar à OS (**pela rede** com o código mostrado na OS
   ou **por arquivo** `.gstilaudo`).
4. **Otimizar este computador** (opcional): marcar as ações, informar **quem autorizou** e
   confirmar. Ao terminar, **Gerar laudo de saída agora** registra as ações no laudo.
5. **Drivers** e **Instalar programas** (pós-formatação, opcional): ver abaixo. Otimização, drivers e
   programas da mesma visita entram juntos no laudo de saída.
6. Na OS: PDF de cada laudo e **comparativo** entrada × saída (inclui espaço liberado e drivers).

## Otimização

| Sistema | Limpeza | Desempenho e aparência (reversível) | Manutenção |
|---|---|---|---|
| Windows | Temporários (+1 dia) · miniaturas · downloads do Windows Update · relatórios de erro e despejos · cache dos navegadores · DISM (demorada) · Lixeira* | Efeitos visuais para desempenho · sugestões/anúncios/apps automáticos · gravação de jogos (Game Bar) · agendamento de GPU por hardware · alto desempenho (só desktops) · apps da Loja em segundo plano · barra de tarefas leve (widgets, notícias, Copilot) · hibernação · remover apps patrocinados* | Ponto de restauração (sempre primeiro) · TRIM/desfragmentação · DNS · SFC (demorada) |
| macOS | Caches do usuário · logs antigos · Lixeira* | Menos animações e transparência · Dock e Mission Control mais rápidos | DNS · verificar volume · reindexar Spotlight |
| Linux | Cache de pacotes · journal (7 dias) · miniaturas · cache dos navegadores · Lixeira* | Animações do GNOME · swappiness 10 · pacotes órfãos* | TRIM · DNS |

\* apagam dados ou removem programas: desmarcadas e num grupo separado.

**Desfazer ajustes**: cada ajuste de desempenho guarda o valor anterior antes de mudar
(Windows: `%ProgramData%\GSTI-Diagnostico\ajustes.json` — registro, plano de energia,
hibernação; macOS/Linux: script de desfazer na pasta do usuário e `/etc/sysctl.d/99-gsti-diagnostico.conf`).
A ação **Desfazer ajustes** restaura os originais, mesmo em outra visita. Apps removidos não
voltam (reinstalam-se pela loja).

Ficaram de fora de propósito ajustes sem ganho real ou com risco (desligar serviços como
SysMain/indexação, "limpadores de registro", mexer em arquivo de paginação, desativar Windows
Defender ou atualizações).

- Ações que **apagam dados do cliente** vêm desmarcadas e aparecem num grupo separado.
- Exige **nome de quem autorizou** e confirmação; o registro (ação, situação, espaço liberado,
  detalhe) entra no laudo de saída e no PDF.
- No Windows o agente já roda como administrador; no macOS/Linux as ações de administrador
  rodam juntas com **um único pedido de senha** (`osascript` / `pkexec`).

### Scripts da assistência

Coloque scripts próprios ao lado do agente, em `scripts/windows/*.ps1`, `scripts/macos/*.sh`
ou `scripts/linux/*.sh`. Eles aparecem no grupo "Scripts da assistência", desmarcados:

```powershell
# nome: Remover barra de ferramentas X
# descricao: Desinstala a barra X que vem com o instalador Y
# risco: medio          # baixo | medio (medio = apaga dados/programas)
# lento: nao            # sim = pode levar minutos
# admin: sim            # macOS/Linux: sim roda com senha de administrador (Windows: sempre)
# ... seu script ...
Resultado 0 "Barra removida."        # Windows: Resultado <bytes liberados> "detalhe"
```

No macOS/Linux use `resultado <bytes> "detalhe"` (funções `tam`, `livre` e `resultado` já
estão disponíveis). Sem a linha de resultado, vale o código de saída (0 = ok). O laudo registra
o nome e o hash (sha256) do script executado.

## Pós-formatação

### Drivers (Windows)

O laudo de entrada já traz o **inventário**: drivers de fabricantes, os com mais de 3 anos,
dispositivos sem driver (código 28) e com erro. Na tela **Drivers**:

1. **Antes de formatar — Fazer backup dos drivers**: `pnputil /export-driver` para
   `drivers-backup/<número de série>_<data>/` no pen drive, com `manifesto.json`
   (`gsti-drivers-backup`: pacotes, versões e o que é antigo).
2. **Depois de formatar — Instalar drivers**, nesta ordem:
   1. driver de **rede** (placa de rede/Wi-Fi) do repositório ou do backup — sem rede não há o resto;
   2. **Windows Update** (API oficial, só drivers);
   3. **ferramenta do fabricante**, se for Dell (Dell Command | Update), Lenovo (System Update) ou
      HP (HP Image Assistant) — instalada pelo winget quando faltar;
   4. novo inventário e, do plano escolhido, só o que **ainda falta ou continua mais antigo**;
   5. `pnputil /scan-devices` e lista do que ficou sem driver.

Regras do plano: hardware ID exato vale mais que ID compatível; atualização só do **mesmo
fornecedor** (não troca o driver da Realtek por um genérico da Microsoft) e **nunca rebaixa**;
o **repositório da assistência** (`drivers/windows/`, ver
[REPOSITORIO-DE-DRIVERS.md](../docs/REPOSITORIO-DE-DRIVERS.md)) tem prioridade sobre o backup;
INF sem catálogo assinado (`.cat`) vem desmarcado. BIOS/firmware não são atualizados.

### Programas

Instalação silenciosa e selecionável pela fonte oficial de cada sistema, sempre na versão mais
recente: **winget** no Windows (registra o "Instalador de Aplicativo" se faltar), **Homebrew**
(casks) no macOS e **Flathub** (`--user`) no Linux. Programa já instalado é mantido.

Categorias: navegadores (Chrome, Firefox, Brave, Opera), escritório (LibreOffice, ONLYOFFICE,
WPS, Microsoft 365), PDF (Acrobat Reader, Foxit, SumatraPDF, PDF24, Okular), compactadores
(7-Zip/Keka/PeaZip, WinRAR), áudio e vídeo, comunicação (WhatsApp, Zoom, Teams, Telegram,
Discord), acesso remoto, nuvem, componentes essenciais do Windows (Visual C++, .NET, Java) e
utilitários. Vêm marcados os básicos: Chrome, Acrobat Reader, 7-Zip, VLC e Visual C++.

Programas da assistência (inclusive **instaladores offline**) ficam em
`programas/programas.json`, ao lado do agente:

```json
[
  { "nome": "Sistema do banco X", "categoria": "utilitarios", "padrao": true,
    "windows": { "instalador": "banco-x.exe", "argumentos": ["/S"] } },
  { "nome": "Leitor de NF-e", "nota": "Pedido pelo cliente",
    "windows": { "winget": "Fornecedor.Programa" }, "macos": { "brew": "cask" }, "linux": { "flatpak": "org.x.Y" } }
]
```

O instalador precisa estar na própria pasta `programas/`; `argumentos` são os de instalação
silenciosa do fabricante. Os IDs do catálogo padrão são conferidos no CI
(`node diagnostico/verificar-catalogo.js`).

Licenças: Microsoft 365, WinRAR, AnyDesk e TeamViewer (uso comercial) dependem da licença do
cliente — a tela avisa e a confirmação de autorização cita isso.

## Segurança e limites

- A coleta não altera nada; o teste de disco usa um arquivo temporário apagado em seguida.
- O laudo tem hash de integridade: arquivo editado depois de gerado é recusado.
- Recebimento pela rede: só com a tela aberta, expira em 15 min, código de 6 dígitos, 5 erros
  encerram. Na primeira vez o firewall do Windows pode pedir permissão (rede privada).
- Sem administrador/root, SMART e temperaturas podem ficar de fora (o laudo registra).
- macOS: temperaturas e desgaste do SSD não são lidos sem ferramentas extras.
- A leitura do disco não é medida (o cache do sistema distorce); só a gravação.

## Build, CI e publicação

```bash
npm run dist:diagnostico          # Windows  → dist_diagnostico/GSTI-Diagnostico-<v>-windows-x64.exe
npm run dist:diagnostico:mac      # macOS (rodar num Mac) → -macos-x64.zip e -macos-arm64.zip
npm run dist:diagnostico:linux    # Linux (rodar no Linux) → -linux-x64.AppImage
npm run diagnostico               # agente em desenvolvimento
npm run diagnostico:cli           # diagnóstico no terminal
```

O workflow **`.github/workflows/diagnostico.yml`** (Actions → *GSTI Diagnóstico* → *Run
workflow*, ou tag `diagnostico-v*`) roda a coleta real em Windows, macOS e Ubuntu (usuário e
root), confere o catálogo de programas (winget, Homebrew, Flathub), guarda os laudos gerados
e produz os três agentes como artefatos.

Publicar no servidor de licenças, um arquivo por plataforma:

```bash
node admin.js publicar-diagnostico GSTI-Diagnostico-1.2.0-windows-x64.exe
node admin.js publicar-diagnostico GSTI-Diagnostico-1.2.0-macos-arm64.zip
node admin.js publicar-diagnostico GSTI-Diagnostico-1.2.0-macos-x64.zip
node admin.js publicar-diagnostico GSTI-Diagnostico-1.2.0-linux-x64.AppImage
```

A versão do agente fica em `diagnostico/versao.json`.
