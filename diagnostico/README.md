# GSTI Diagnóstico — agente portátil, laudos e otimização

Módulo vendável **Diagnóstico** (chave `diagnostico`). O técnico roda o agente a partir de um
pen drive no computador do cliente (**Windows, macOS ou Linux**), gera o **laudo técnico**,
executa a **otimização** autorizada pelo cliente e anexa os laudos à **OS** no GSTI App, na
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
5. Na OS: PDF de cada laudo e **comparativo** entrada × saída (inclui espaço liberado).

## Otimização

| Sistema | Ações incluídas |
|---|---|
| Windows | Ponto de restauração · temporários (+1 dia) · cache de miniaturas · downloads do Windows Update · cache DNS · DISM limpeza de componentes (demorada) · otimizar unidade (TRIM/desfragmentação) · SFC (demorada) · Lixeira (apaga dados) |
| macOS | Caches do usuário · logs antigos · cache DNS · verificar volume (demorada) · reindexar Spotlight (demorada) · Lixeira (apaga dados) |
| Linux | Cache de pacotes (apt/dnf/pacman/zypper) · journal (7 dias) · miniaturas · TRIM · cache DNS · pacotes órfãos (apaga dados) · Lixeira (apaga dados) |

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
root), guarda os laudos gerados e produz os três agentes como artefatos.

Publicar no servidor de licenças, um arquivo por plataforma:

```bash
node admin.js publicar-diagnostico GSTI-Diagnostico-1.1.0-windows-x64.exe
node admin.js publicar-diagnostico GSTI-Diagnostico-1.1.0-macos-arm64.zip
node admin.js publicar-diagnostico GSTI-Diagnostico-1.1.0-macos-x64.zip
node admin.js publicar-diagnostico GSTI-Diagnostico-1.1.0-linux-x64.AppImage
```

A versão do agente fica em `diagnostico/versao.json`.
