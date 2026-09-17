// Ações de otimização do macOS e do Linux (bash). Ações "admin" rodam juntas, com um único
// pedido de senha. Ajustes de configuração guardam o valor anterior num script de desfazer:
//   macOS: ~/Library/Application Support/GSTI-Diagnostico/desfazer.sh
//   Linux: ~/.local/share/gsti-diagnostico/desfazer.sh (e /etc/sysctl.d/99-gsti-diagnostico.conf)

const UTIL = String.raw`
tam() { du -sk "$@" 2>/dev/null | awk '{s+=$1} END {print s*1024+0}'; }
livre() { df -Pk / | awk 'NR==2 {print $4*1024}'; }
resultado() { printf 'GSTI_RESULTADO {"liberadoBytes": %s, "detalhe": "%s"}\n' "$1" "$2"; }
if [ "$(uname)" = "Darwin" ]; then DESFAZER="$HOME/Library/Application Support/GSTI-Diagnostico/desfazer.sh"; else DESFAZER="$HOME/.local/share/gsti-diagnostico/desfazer.sh"; fi
[ -n "$GSTI_DESFAZER_ARQUIVO" ] && DESFAZER="$GSTI_DESFAZER_ARQUIVO"
# Registra o comando que desfaz um ajuste (só na primeira vez para cada chave)
registrar_desfazer() { local chave="$1" comando="$2"; mkdir -p "$(dirname "$DESFAZER")"; grep -qxF "# $chave" "$DESFAZER" 2>/dev/null || printf '# %s\n%s\n' "$chave" "$comando" >> "$DESFAZER"; }
# macOS: defaults write guardando o valor anterior
definir_default() {
  local dominio="$1" chave="$2" tipo="$3" valor="$4" atual
  if atual=$(defaults read "$dominio" "$chave" 2>/dev/null); then
    registrar_desfazer "$dominio $chave" "defaults write $(printf %q "$dominio") $(printf %q "$chave") $tipo $(printf %q "$atual")"
  else
    registrar_desfazer "$dominio $chave" "defaults delete $(printf %q "$dominio") $(printf %q "$chave") 2>/dev/null"
  fi
  defaults write "$dominio" "$chave" "$tipo" "$valor"
}
`;

const MACOS = [
  {
    id: "caches-usuario", categoria: "limpeza", nome: "Limpar caches do usuário", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Apaga ~/Library/Caches; os aplicativos recriam o que precisarem. Feche os programas antes.",
    script: String.raw`
antes=$(tam "$HOME/Library/Caches")
find "$HOME/Library/Caches" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
depois=$(tam "$HOME/Library/Caches")
resultado $((antes > depois ? antes - depois : 0)) "Caches removidos (itens protegidos pelo sistema são mantidos)."`,
  },
  {
    id: "logs-usuario", categoria: "limpeza", nome: "Limpar logs antigos do usuário", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Apaga logs de aplicativos com mais de 7 dias.",
    script: String.raw`
antes=$(tam "$HOME/Library/Logs")
find "$HOME/Library/Logs" -type f -mtime +7 -delete 2>/dev/null
depois=$(tam "$HOME/Library/Logs")
resultado $((antes > depois ? antes - depois : 0)) "Logs com mais de 7 dias removidos."`,
  },
  {
    id: "dns", categoria: "manutencao", nome: "Limpar cache de DNS", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Resolve sites que não abrem por endereço antigo em cache.",
    script: String.raw`
dscacheutil -flushcache; killall -HUP mDNSResponder 2>/dev/null
resultado 0 "Cache de DNS limpo."`,
  },
  {
    id: "verificar-disco", categoria: "manutencao", nome: "Verificar o volume do sistema", risco: "baixo", admin: true, lento: true, padrao: false,
    descricao: "diskutil verifyVolume: verifica a estrutura do sistema de arquivos sem alterar nada.",
    script: String.raw`
if diskutil verifyVolume / >/tmp/gsti-verify.log 2>&1; then resultado 0 "Volume verificado: sem problemas."; else resultado 0 "A verificação encontrou problemas: repare pelo Utilitário de Disco (modo de recuperação)."; fi`,
  },
  {
    id: "spotlight", categoria: "manutencao", nome: "Reindexar o Spotlight", risco: "baixo", admin: true, lento: true, padrao: false,
    descricao: "Recria o índice de busca (resolve busca lenta ou incompleta). A indexação continua em segundo plano.",
    script: String.raw`
mdutil -E / >/dev/null 2>&1
resultado 0 "Reindexação iniciada."`,
  },
  {
    id: "animacoes", categoria: "desempenho", nome: "Menos animações e transparência", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Desliga animações de janelas e reduz movimento e transparência (Acessibilidade). Deixa a interface mais ágil em Macs mais antigos.",
    script: String.raw`
definir_default NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false
definir_default NSGlobalDomain NSWindowResizeTime -float 0.001
avisos=""
definir_default com.apple.universalaccess reduceMotion -bool true 2>/dev/null || avisos=" (Reduzir movimento exige permissão: ative em Ajustes > Acessibilidade > Tela)"
definir_default com.apple.universalaccess reduceTransparency -bool true 2>/dev/null || avisos=" (Reduzir transparência exige permissão: ative em Ajustes > Acessibilidade > Tela)"
resultado 0 "Animações reduzidas; vale para apps abertos daqui em diante$avisos."`,
  },
  {
    id: "dock-rapido", categoria: "desempenho", nome: "Dock e Mission Control mais rápidos", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Remove a animação ao abrir apps, acelera o Mission Control e o surgimento do Dock oculto.",
    script: String.raw`
definir_default com.apple.dock launchanim -bool false
definir_default com.apple.dock expose-animation-duration -float 0.1
definir_default com.apple.dock autohide-delay -float 0
definir_default com.apple.dock mineffect -string scale
killall Dock 2>/dev/null
resultado 0 "Dock ajustado."`,
  },
  {
    id: "lixeira", categoria: "limpeza", nome: "Esvaziar a Lixeira", risco: "medio", admin: false, lento: false, padrao: false,
    descricao: "Apaga definitivamente os arquivos da Lixeira. Só marque com autorização do cliente.",
    script: String.raw`
antes=$(tam "$HOME/.Trash")
find "$HOME/.Trash" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null
depois=$(tam "$HOME/.Trash")
resultado $((antes > depois ? antes - depois : 0)) "Lixeira esvaziada (sem Acesso Total ao Disco o macOS pode impedir)."`,
  },
  {
    id: "desfazer-ajustes", categoria: "reverter", nome: "Desfazer ajustes do GSTI Diagnóstico", risco: "baixo", admin: false, lento: false, padrao: false,
    descricao: "Volta os valores originais das animações e do Dock alterados pelo agente neste Mac.",
    script: String.raw`
if [ ! -f "$DESFAZER" ]; then resultado 0 "Nenhum ajuste registrado neste Mac."; exit 0; fi
n=$(grep -c '^# ' "$DESFAZER")
bash "$DESFAZER" && rm -f "$DESFAZER"
killall Dock 2>/dev/null
resultado 0 "Restaurados $n ajuste(s)."`,
  },
];

const LINUX = [
  {
    id: "cache-pacotes", categoria: "limpeza", nome: "Limpar cache de pacotes", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Remove pacotes baixados já instalados (apt, dnf, pacman ou zypper).",
    script: String.raw`
antes=$(livre)
if command -v apt-get >/dev/null; then apt-get clean
elif command -v dnf >/dev/null; then dnf clean all -q
elif command -v pacman >/dev/null; then pacman -Sc --noconfirm >/dev/null
elif command -v zypper >/dev/null; then zypper clean -a >/dev/null
fi
depois=$(livre)
resultado $((depois > antes ? depois - antes : 0)) "Cache de pacotes limpo."`,
  },
  {
    id: "journal", categoria: "limpeza", nome: "Reduzir logs do sistema (journal)", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "Mantém só os últimos 7 dias de logs do systemd.",
    script: String.raw`
antes=$(livre)
journalctl --vacuum-time=7d >/dev/null 2>&1
depois=$(livre)
resultado $((depois > antes ? depois - antes : 0)) "Logs com mais de 7 dias removidos."`,
  },
  {
    id: "cache-usuario", categoria: "limpeza", nome: "Limpar miniaturas do usuário", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Apaga ~/.cache/thumbnails; o sistema recria conforme as pastas são abertas.",
    script: String.raw`
antes=$(tam "$HOME/.cache/thumbnails")
rm -rf "$HOME/.cache/thumbnails/"* 2>/dev/null
resultado "$antes" "Miniaturas removidas."`,
  },
  {
    id: "cache-navegadores", categoria: "limpeza", nome: "Limpar cache dos navegadores", risco: "baixo", admin: false, lento: false, padrao: false,
    descricao: "Chrome, Chromium e Firefox: só o cache (não apaga senhas, histórico nem logins). Feche os navegadores antes.",
    script: String.raw`
if pgrep -x chrome >/dev/null || pgrep -x chromium >/dev/null || pgrep -x firefox >/dev/null; then resultado 0 "Navegadores abertos: feche e execute de novo."; exit 0; fi
alvos="$HOME/.cache/google-chrome $HOME/.cache/chromium $HOME/.cache/mozilla/firefox"
antes=$(tam $alvos)
for a in $alvos; do [ -d "$a" ] && find "$a" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null; done
resultado "$antes" "Cache dos navegadores limpo."`,
  },
  {
    id: "trim", categoria: "manutencao", nome: "Enviar TRIM aos SSDs", risco: "baixo", admin: true, lento: false, padrao: true,
    descricao: "fstrim em todos os sistemas de arquivos montados que suportam.",
    script: String.raw`
saida=$(fstrim -av 2>&1 | tr '\n' ' ' | tr -d '"')
resultado 0 "TRIM: $saida"`,
  },
  {
    id: "dns", categoria: "manutencao", nome: "Limpar cache de DNS", risco: "baixo", admin: true, lento: false, padrao: false,
    descricao: "systemd-resolved: resolvectl flush-caches.",
    script: String.raw`
(resolvectl flush-caches || systemd-resolve --flush-caches) >/dev/null 2>&1
resultado 0 "Cache de DNS limpo."`,
  },
  {
    id: "animacoes", categoria: "desempenho", nome: "Desativar animações da área de trabalho (GNOME)", risco: "baixo", admin: false, lento: false, padrao: true,
    descricao: "Interface mais ágil em computadores modestos. Só no GNOME (Ubuntu, Fedora); em outros ambientes é ignorado.",
    script: String.raw`
if ! command -v gsettings >/dev/null || ! gsettings list-keys org.gnome.desktop.interface 2>/dev/null | grep -qx enable-animations; then resultado 0 "Ambiente sem GNOME: nada alterado."; exit 0; fi
registrar_desfazer "gnome enable-animations" "gsettings set org.gnome.desktop.interface enable-animations $(gsettings get org.gnome.desktop.interface enable-animations)"
gsettings set org.gnome.desktop.interface enable-animations false
resultado 0 "Animações do GNOME desativadas."`,
  },
  {
    id: "swappiness", categoria: "desempenho", nome: "Usar menos swap (swappiness 10)", risco: "baixo", admin: true, lento: false, padrao: false,
    descricao: "O sistema passa a preferir a RAM ao disco: menos travadas com 8 GB ou mais de memória. Arquivo /etc/sysctl.d/99-gsti-diagnostico.conf (reversível).",
    script: String.raw`
printf 'vm.swappiness=10\n' > /etc/sysctl.d/99-gsti-diagnostico.conf
sysctl -q -p /etc/sysctl.d/99-gsti-diagnostico.conf
resultado 0 "vm.swappiness ajustado para 10."`,
  },
  {
    id: "pacotes-orfaos", categoria: "desempenho", nome: "Remover pacotes órfãos", risco: "medio", admin: true, lento: false, padrao: false,
    descricao: "Remove dependências que nenhum programa usa mais (apt/dnf autoremove). Revise antes em sistemas personalizados.",
    script: String.raw`
antes=$(livre)
if command -v apt-get >/dev/null; then DEBIAN_FRONTEND=noninteractive apt-get autoremove -y >/dev/null
elif command -v dnf >/dev/null; then dnf autoremove -y -q
elif command -v pacman >/dev/null; then orfaos=$(pacman -Qdtq); [ -n "$orfaos" ] && pacman -Rns --noconfirm $orfaos >/dev/null
fi
depois=$(livre)
resultado $((depois > antes ? depois - antes : 0)) "Pacotes órfãos removidos."`,
  },
  {
    id: "lixeira", categoria: "limpeza", nome: "Esvaziar a Lixeira", risco: "medio", admin: false, lento: false, padrao: false,
    descricao: "Apaga definitivamente os arquivos da Lixeira. Só marque com autorização do cliente.",
    script: String.raw`
antes=$(tam "$HOME/.local/share/Trash")
rm -rf "$HOME/.local/share/Trash/files/"* "$HOME/.local/share/Trash/info/"* 2>/dev/null
resultado "$antes" "Lixeira esvaziada."`,
  },
  {
    id: "desfazer-ajustes", categoria: "reverter", nome: "Desfazer ajustes da área de trabalho", risco: "baixo", admin: false, lento: false, padrao: false,
    descricao: "Volta as animações do GNOME ao valor original.",
    script: String.raw`
if [ ! -f "$DESFAZER" ]; then resultado 0 "Nenhum ajuste registrado para este usuário."; exit 0; fi
n=$(grep -c '^# ' "$DESFAZER")
bash "$DESFAZER" && rm -f "$DESFAZER"
resultado 0 "Restaurados $n ajuste(s)."`,
  },
  {
    id: "desfazer-swappiness", categoria: "reverter", nome: "Restaurar o uso de swap padrão", risco: "baixo", admin: true, lento: false, padrao: false,
    descricao: "Remove o ajuste de swappiness feito pelo agente (volta ao padrão da distribuição após reiniciar).",
    script: String.raw`
if [ ! -f /etc/sysctl.d/99-gsti-diagnostico.conf ]; then resultado 0 "Nenhum ajuste de swap feito pelo agente."; exit 0; fi
rm -f /etc/sysctl.d/99-gsti-diagnostico.conf
sysctl -q vm.swappiness=60
resultado 0 "Swappiness restaurado (60)."`,
  },
];

module.exports = { UTIL, MACOS, LINUX };
