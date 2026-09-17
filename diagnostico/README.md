# GSTI Diagnóstico — agente portátil e laudos técnicos

Módulo vendável **Diagnóstico** (chave `diagnostico`). O técnico roda o agente a partir de um
pen drive no computador do cliente, gera o **laudo técnico** e o anexa à **OS** no GSTI App,
na entrada e na saída do reparo (com comparativo antes/depois).

## Peças

| Arquivo | Onde roda | Função |
|---|---|---|
| `coleta-windows.js` | agente | Script PowerShell/CIM único (só leitura): hardware, sistema, discos + SMART, volumes, bateria (`powercfg /batteryreport`), temperaturas, ativação, antivírus, rede e eventos de erro |
| `testes-rapidos.js` | agente | Gravação no disco (256 MB com fsync, apagado ao final), internet (DNS, latência, download de 10 MB) e uso de CPU |
| `laudo.js` | agente e app | Formato `gsti-laudo` v1, alertas, situação geral, integridade (sha256), comparação antes/depois, resumo |
| `laudo-html.js` | agente e app | Laudo e comparativo em HTML A4 (visualizar e gerar PDF) |
| `rede-local.js` | agente e app | Descoberta por UDP (porta 47851) e envio HTTP com código de 6 dígitos |
| `agente/` | agente | Electron portátil (interface em HTML/JS puro) |
| `../laudos-os.js` | app | Tabela `os_laudos`, importar, receber pela rede, PDFs e download do agente |

## Uso

1. No GSTI App: **OS → ícone de laudos → Baixar GSTI Diagnóstico** (salva no pen drive) — ou
   pela área do cliente no site.
2. No computador do cliente: abrir `GSTI-Diagnostico-x.y.z.exe` (pede administrador para ler
   SMART e temperaturas), escolher **Entrada** ou **Saída**, nº da OS e **Iniciar diagnóstico**.
3. Enviar ao GSTI App:
   - **pela rede**: na OS, *Receber pela rede* mostra um código; no agente, *Enviar para o GSTI App*,
     escolher a loja e digitar o código (ou digitar `IP:porta` se a loja não aparecer);
   - **por arquivo**: *Salvar arquivo do laudo* (`.gstilaudo`) e, na OS, *Importar arquivo*.
4. Na OS: ver/salvar PDF de cada laudo e o **comparativo** entrada × saída.

O agente também salva PDF e compara com um laudo de entrada sem o GSTI App.

## Segurança e limites

- Nada é instalado nem alterado no computador do cliente; o teste de disco usa um arquivo
  temporário apagado em seguida.
- O laudo tem hash de integridade: arquivo editado depois de gerado é recusado.
- Recebimento pela rede: só enquanto a tela está aberta, expira em 15 min, código de 6 dígitos,
  5 erros encerram; o laudo é validado antes de gravar. Na primeira vez o Windows pode pedir
  para liberar o GSTI App no firewall (rede privada).
- Sem administrador, SMART e temperaturas podem ficar de fora (o laudo registra a limitação).
- A leitura do disco não é medida (o cache do Windows distorce); só a gravação.

## Build e publicação

```bash
npm run dist:diagnostico     # dist_diagnostico/GSTI-Diagnostico-<versão>.exe (versão em diagnostico/versao.json)
# no servidor de licenças:
node admin.js publicar-diagnostico GSTI-Diagnostico-<versão>.exe
```

Rodar em desenvolvimento: `npm run diagnostico`.
