# Repositório de drivers da assistência

Guia para montar, desde já, o repositório de drivers que o **GSTI Diagnóstico** vai usar na
pós-formatação. A ideia: ter os drivers **mais recentes e confiáveis** dos equipamentos que
mais passam pela bancada, para instalar mesmo sem internet (inclusive a placa de rede) e
**nunca** depender do backup antigo do cliente como fonte principal.

> Status: estrutura definida; a leitura automática pelo agente entra na etapa de drivers
> (ver [PROXIMA-VERSAO.md](./PROXIMA-VERSAO.md), módulo de diagnóstico).

---

## 1. Regras de ouro

1. **Só fonte oficial**: site/ferramenta do fabricante do equipamento (Dell, Lenovo, HP,
   Acer, ASUS, Positivo…) ou do componente (Intel, AMD, NVIDIA, Realtek, Qualcomm/Atheros,
   MediaTek, Broadcom). Nunca de "packs" (DriverPack, Snappy, sites de download genéricos).
2. **Driver em formato INF** (arquivos `.inf` + `.sys` + `.cat`). É o formato que o Windows
   instala sozinho pelo hardware ID (`pnputil`). Instaladores `.exe` só como complemento
   (painéis de controle de vídeo/áudio), em pasta separada.
3. **Não altere nada dentro do driver.** O arquivo `.cat` é a assinatura digital; qualquer
   mudança invalida e o Windows recusa.
4. **Uma versão por pasta**, com a versão e a data no nome. Guarde a atual e a anterior
   (para voltar se a nova der problema); apague as mais antigas.
5. **Anote a origem** (link oficial e data do download) em `origem.txt`.
6. **Não redistribua** o repositório para terceiros nem publique em servidor aberto: é para
   uso interno da assistência (licença dos fabricantes).

---

## 2. Estrutura de pastas

Fica no pen drive ao lado do agente (ou numa pasta de rede da loja):

```
GSTI-Diagnostico-x.y.z-windows-x64.exe
drivers/
  windows/
    rede/
      intel/
        wifi-ax200-ax201-ax210/
          23.60.1.2_2024-05/
            Netwtw10.inf
            Netwtw10.cat
            Netwtw10.sys
            ...
            origem.txt
      realtek/
        ethernet-rtl8111-8168/
          10.68.1115.2023_2023-11/
            ...
    video/
      intel/uhd-iris-xe/31.0.101.5186_2024-02/...
      amd/radeon-rx-5000-7000/.../
      nvidia/geforce-10-40/.../
    chipset/
      intel/chipset-inf/10.1.19600.8418_2023-09/...
      amd/chipset-ryzen/.../
    armazenamento/
      intel/rst-vmd-11-13-geracao/19.5.2.1049_2023-06/...     ← essencial para o Windows ver o SSD em notebooks Intel 11ª+
    audio/
      realtek/hd-audio/.../
    bluetooth/
    leitor-cartao/
    touchpad/
    usb-thunderbolt/
    fabricantes/                  ← pacotes completos por modelo (quando o fabricante oferece)
      dell/latitude-5420/2024-03/...
      lenovo/thinkpad-e14-gen2-20ta/2024-01/...
    instaladores/                 ← .exe complementares (painel NVIDIA, Realtek Audio Console…)
      nvidia/...
```

**Categorias** (use estes nomes): `rede`, `video`, `chipset`, `armazenamento`, `audio`,
`bluetooth`, `leitor-cartao`, `touchpad`, `usb-thunderbolt`, `camera`, `sensores`, `outros`.

**Nome da pasta de versão**: `<versão do driver>_<AAAA-MM da data do driver>`
(a versão e a data aparecem no `.inf`, linha `DriverVer = 05/10/2024,23.60.1.2`).

### `origem.txt` (um por pasta de versão)

```
fabricante: Intel
produto: Wi-Fi 6 AX200/AX201/AX210
versao: 23.60.1.2
data-driver: 2024-05-10
fonte: https://www.intel.com.br/content/www/br/pt/download/19351/...
baixado-em: 2024-06-02
baixado-por: Marcos
observacao: extraído do instalador WiFi-23.60.1-Driver64-Win10-Win11.exe
```

---

## 3. Como obter o driver em formato INF

Do mais fácil para o mais trabalhoso:

1. **Já vem em INF/ZIP** no site (comum em Intel, Realtek, Dell "Drivers" em .zip, Lenovo
   "Readme + INF"): basta descompactar.
2. **Exportar de um computador já atualizado** (o melhor jeito para rede/Wi-Fi):
   ```powershell
   # lista os drivers de terceiros instalados (procure o dispositivo)
   pnputil /enum-drivers
   # exporta um driver específico (use o "Published Name", ex.: oem42.inf)
   pnputil /export-driver oem42.inf D:\drivers\windows\rede\intel\wifi-ax200-ax201-ax210\23.60.1.2_2024-05
   ```
3. **Extrair do instalador .exe**:
   - Dell: `Instalador.exe /s /e=C:\extraido`
   - Lenovo: `instalador.exe /VERYSILENT /DIR=C:\extraido /EXTRACT=YES`
   - HP (SoftPaq): `sp123456.exe /s /e /f C:\extraido`
   - Intel/Realtek genéricos: abrir com **7-Zip** e extrair; ou executar e copiar a pasta
     temporária que ele cria (`%TEMP%`) antes de concluir.
   - NVIDIA/AMD: o pacote extraído tem a pasta `Display.Driver` (NVIDIA) ou `Packages\Drivers`
     (AMD) com o INF.
4. **Pacotes de drivers por modelo** (implantação corporativa, já em INF):
   - Dell: "Dell Command | Deploy Driver Packs" (CAB por modelo)
   - Lenovo: "SCCM Driver Packs" por modelo
   - HP: "HP Driver Packs" (SoftPaq por plataforma)
   Guarde em `fabricantes/<marca>/<modelo>/<AAAA-MM>/`.

Depois de montar a pasta, confira a assinatura (deve mostrar "Assinado" e o fabricante):

```powershell
Get-AuthenticodeSignature D:\drivers\windows\rede\intel\...\Netwtw10.cat | Format-List Status, SignerCertificate
```

---

## 4. O que priorizar

Comece pelo que mais trava a pós-formatação e pelos equipamentos mais comuns na sua bancada:

1. **Rede e Wi-Fi** (Intel, Realtek, MediaTek, Qualcomm) — sem eles não há internet para o
   restante.
2. **Armazenamento Intel RST/VMD** — notebooks Intel de 11ª geração em diante não mostram o
   SSD na instalação do Windows sem ele.
3. **Chipset** (Intel Chipset INF, AMD Chipset) e **Serial IO/I2C** (touchpad).
4. **Vídeo** (Intel, AMD, NVIDIA).
5. Áudio, Bluetooth, leitor de cartão, câmera.
6. Pacotes completos por modelo dos notebooks que mais aparecem (Dell, Lenovo, HP, Positivo,
   Acer, ASUS, Samsung).

Revise a cada 3–6 meses: baixe a versão nova, mantenha a anterior e apague as mais antigas.

---

## 5. Como o agente vai usar (planejado)

1. Lê `drivers/windows/**/*.inf` e monta um índice (hardware IDs, versão, data, arquivo).
2. No laudo de entrada, compara com os dispositivos do computador e mostra, por dispositivo,
   se o repositório tem **versão mais nova** que a instalada.
3. Na pós-formatação, a ordem será: essencial de rede do **repositório** → **Windows Update**
   → **ferramenta/catálogo do fabricante** → **repositório** para o que faltar → backup do
   cliente só para o que não existir em nenhuma fonte — sempre sem instalar versão mais antiga
   que a já presente.
4. Opção "Adicionar ao repositório": exporta um driver atualizado deste computador direto para
   a pasta certa, já com `origem.txt`.
