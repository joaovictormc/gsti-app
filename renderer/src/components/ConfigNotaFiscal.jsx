import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import ConfirmDialog from "./ConfirmDialog";

// Configurações > Nota fiscal: como funciona (aceite), escolha do emissor,
// credenciais, dados fiscais da empresa e certificado digital A1.

const REGIMES = ["Simples Nacional", "Simples Nacional — MEI", "Lucro Presumido", "Lucro Real"];

const formatarDocumento = (doc) => {
  if (!doc?.numero) return "—";
  const n = doc.numero;
  return n.length === 14
    ? n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
    : n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};
const formatarData = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

const textoCertificado = {
  app: "Precisa do certificado A1 cadastrado neste app",
  emissor: "Certificado A1 enviado ao painel do emissor",
};

export default function ConfigNotaFiscal() {
  const [carregando, setCarregando] = useState(true);
  const [dados, setDados] = useState(null);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [salvando, setSalvando] = useState(false);
  const [leuTermo, setLeuTermo] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [detalhe, setDetalhe] = useState(null);
  const [empresa, setEmpresa] = useState({});
  const [credenciais, setCredenciais] = useState({});
  const [certArquivo, setCertArquivo] = useState(null);
  const [certSenha, setCertSenha] = useState("");
  const [confirmarRemocao, setConfirmarRemocao] = useState(false);

  const aplicar = (r) => {
    setDados(r);
    setEmpresa(r.fiscal.empresa);
    setCredenciais({});
    setDetalhe((atual) => atual || r.fiscal.emissor);
  };

  useEffect(() => {
    window.api
      .getFiscalSettings()
      .then((r) => (r.success ? aplicar(r) : setMensagem({ tipo: "error", texto: r.error })))
      .finally(() => setCarregando(false));
  }, []);

  const emissores = useMemo(
    () => (dados?.emissores || []).filter((e) => filtro === "todos" || e.custo.gratuito),
    [dados, filtro]
  );

  if (carregando) {
    return (
      <Paper sx={{ p: 3, mb: 3, display: "flex", justifyContent: "center" }}>
        <CircularProgress />
      </Paper>
    );
  }
  if (!dados) return null;

  const { fiscal, recursoEmissorIntegrado } = dados;
  const termoAceito = fiscal.termo?.versao === fiscal.termoVersaoAtual;
  const emissorDetalhe = dados.emissores.find((e) => e.id === detalhe);

  const salvar = async (payload, textoOk) => {
    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });
    const r = await window.api.saveFiscalSettings(payload);
    setSalvando(false);
    if (r.success) {
      setDados((d) => ({ ...d, fiscal: r.fiscal }));
      setEmpresa(r.fiscal.empresa);
      setCredenciais({});
      setMensagem({ tipo: "success", texto: textoOk });
    } else {
      setMensagem({ tipo: "error", texto: r.error });
    }
  };

  const podeUsar = (e) =>
    e.status === "disponivel" && (!e.integrado || (recursoEmissorIntegrado && termoAceito));

  const motivoBloqueio = (e) => {
    if (e.status !== "disponivel") return "Integração em desenvolvimento.";
    if (e.integrado && !recursoEmissorIntegrado) return "Disponível no plano Anual com renovação automática.";
    if (e.integrado && !termoAceito) return "Leia e aceite \"Como funciona a emissão\" acima.";
    return null;
  };

  const selecionarCertificado = async () => {
    const r = await window.api.selectCertificateFile();
    if (r.success) setCertArquivo(r);
  };

  const cadastrarCertificado = async () => {
    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });
    const r = await window.api.saveCertificate({ arquivo: certArquivo.arquivo, senha: certSenha });
    setSalvando(false);
    if (r.success) {
      setDados((d) => ({ ...d, fiscal: { ...d.fiscal, certificado: r.certificado } }));
      setCertArquivo(null);
      setCertSenha("");
      setMensagem(
        r.aviso
          ? { tipo: "warning", texto: `Certificado cadastrado. Atenção: ${r.aviso}` }
          : { tipo: "success", texto: "Certificado cadastrado e protegido neste computador." }
      );
    } else {
      setMensagem({ tipo: "error", texto: r.error });
    }
  };

  const removerCertificado = async () => {
    const r = await window.api.removeCertificate();
    setConfirmarRemocao(false);
    if (r.success) {
      setDados((d) => ({ ...d, fiscal: { ...d.fiscal, certificado: null } }));
      setMensagem({ tipo: "success", texto: "Certificado removido deste computador." });
    } else {
      setMensagem({ tipo: "error", texto: r.error });
    }
  };

  const cert = fiscal.certificado;
  const diasCert = cert ? Math.ceil((new Date(cert.validoAte) - Date.now()) / 86400000) : null;
  const campoEmpresa = (chave) => ({
    value: empresa[chave] ?? "",
    onChange: (ev) => setEmpresa((e) => ({ ...e, [chave]: ev.target.value })),
    size: "small",
    fullWidth: true,
    disabled: salvando,
  });

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <ReceiptLongIcon color="primary" />
        <Typography variant="h6">Nota fiscal</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Escolha como as notas das OS finalizadas serão emitidas ou registradas.
      </Typography>

      {mensagem.texto && (
        <Alert severity={mensagem.tipo || "info"} sx={{ mb: 2 }} onClose={() => setMensagem({ tipo: "", texto: "" })}>
          {mensagem.texto}
        </Alert>
      )}

      {/* Como funciona */}
      <Alert severity="info" icon={false} sx={{ mb: 2, "& .MuiAlert-message": { width: "100%" } }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Como funciona a emissão de notas no GSTI App
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2.5, "& li": { mb: 0.5 } }}>
          <li>
            O GSTI App <strong>não é um emissor de notas</strong>. Ele registra a nota que você emitiu por fora ou envia
            os dados da OS para o emissor que <strong>você</strong> escolher.
          </li>
          <li>
            A conta no emissor, o contrato, o plano e eventuais custos são <strong>seus</strong>, em nome da sua empresa.
          </li>
          <li>
            <strong>Você é responsável</strong> por cadastrar e manter as credenciais (chaves e tokens), o certificado
            digital e os dados fiscais. Confirme código de tributação, alíquota e regime com seu contador.
          </li>
          <li>
            Credenciais e certificado ficam <strong>cifrados somente neste computador</strong> e não são enviados aos
            servidores do GSTI App. Em outro computador, cadastre novamente.
          </li>
          <li>O conteúdo e a validade das notas emitidas são de responsabilidade da empresa emissora.</li>
        </Box>
        <Divider sx={{ my: 1.5 }} />
        {termoAceito ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <VerifiedUserIcon color="success" fontSize="small" />
            <Typography variant="body2">
              Lido e aceito em {formatarData(fiscal.termo.aceitoEm)}
              {fiscal.termo.usuario ? ` por ${fiscal.termo.usuario}` : ""}.
            </Typography>
          </Stack>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
            <FormControlLabel
              control={<Checkbox checked={leuTermo} onChange={(e) => setLeuTermo(e.target.checked)} />}
              label="Li e entendi. Sou responsável pelas credenciais, pelo certificado digital e pelas informações fiscais cadastradas."
            />
            <Button
              variant="contained"
              size="small"
              disabled={!leuTermo || salvando}
              onClick={() => salvar({ aceitarTermo: true }, "Aceite registrado.")}
              sx={{ flexShrink: 0 }}
            >
              Confirmar
            </Button>
          </Stack>
        )}
      </Alert>

      {!recursoEmissorIntegrado && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => window.api.openLicenseSite("planos")}>
              Ver planos
            </Button>
          }
        >
          A emissão pelo app com emissor integrado está disponível no plano <strong>Anual com renovação automática</strong>.
          No seu plano, use o <strong>Registro manual</strong> (grátis).
        </Alert>
      )}

      {/* Emissores */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, gap: 1, flexWrap: "wrap" }}>
        <Typography variant="subtitle1" fontWeight={600}>Emissor</Typography>
        <ToggleButtonGroup size="small" exclusive value={filtro} onChange={(_, v) => v && setFiltro(v)}>
          <ToggleButton value="todos">Todos</ToggleButton>
          <ToggleButton value="gratuitos">Gratuitos</ToggleButton>
        </ToggleButtonGroup>
      </Box>
      <Grid container spacing={2}>
        {emissores.map((e) => {
          const emUso = fiscal.emissor === e.id;
          const bloqueio = motivoBloqueio(e);
          return (
            <Grid size={{ xs: 12, md: 6 }} key={e.id}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderColor: emUso ? "primary.main" : detalhe === e.id ? "text.secondary" : "divider",
                  borderWidth: emUso ? 2 : 1,
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                    <Typography fontWeight={600}>{e.nome}</Typography>
                    {emUso && <Chip label="Em uso" color="primary" size="small" />}
                  </Stack>
                  <Stack direction="row" spacing={0.5} sx={{ my: 1, flexWrap: "wrap", gap: 0.5 }}>
                    <Chip
                      size="small"
                      label={e.custo.gratuito ? (e.integrado && e.id !== "emissor-nacional" ? "Plano gratuito" : "Grátis") : "Pago"}
                      color={e.custo.gratuito ? "success" : "default"}
                      variant={e.custo.gratuito ? "filled" : "outlined"}
                    />
                    {e.documentos.map((d) => <Chip key={d} size="small" variant="outlined" label={d} />)}
                    {e.status !== "disponivel" && <Chip size="small" color="warning" variant="outlined" label="Em desenvolvimento" />}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">{e.resumo}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    {e.custo.texto} · {e.certificado ? textoCertificado[e.certificado] : "Não precisa de certificado"}
                  </Typography>
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2, pt: 0, flexWrap: "wrap", gap: 1 }}>
                  <Button size="small" onClick={() => setDetalhe(e.id)}>Detalhes</Button>
                  {!emUso && (
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!podeUsar(e) || salvando}
                      onClick={() => salvar({ emissor: e.id }, `Emissor definido: ${e.nome}.`)}
                    >
                      Usar este emissor
                    </Button>
                  )}
                  {bloqueio && <Typography variant="caption" color="text.secondary">{bloqueio}</Typography>}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Detalhes do emissor */}
      {emissorDetalhe && (
        <Box sx={{ mt: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>{emissorDetalhe.nome}</Typography>
          {emissorDetalhe.ondeEmitirGratis && (
            <>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Onde emitir gratuitamente e depois registrar na OS:</Typography>
              <Box component="ul" sx={{ mt: 0, pl: 2.5 }}>
                {emissorDetalhe.ondeEmitirGratis.map((o) => (
                  <li key={o.nome}>
                    <Typography variant="body2">
                      {o.nome} ({o.documentos.join(", ")}){o.url ? ` — ${o.url}` : ""}
                    </Typography>
                  </li>
                ))}
              </Box>
            </>
          )}
          {emissorDetalhe.guia.length > 0 && (
            <>
              <Typography variant="body2" sx={{ mb: 0.5 }}>Passo a passo (feito por você, na sua conta):</Typography>
              <Box component="ol" sx={{ mt: 0, pl: 2.5 }}>
                {emissorDetalhe.guia.map((passo) => (
                  <li key={passo}><Typography variant="body2">{passo}</Typography></li>
                ))}
              </Box>
            </>
          )}
          {emissorDetalhe.site && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              Site: {emissorDetalhe.site}
            </Typography>
          )}

          {emissorDetalhe.credenciais.length > 0 && (
            <FormCredenciais
              emissor={emissorDetalhe}
              salvas={fiscal.credenciais[emissorDetalhe.id] || {}}
              valores={credenciais[emissorDetalhe.id] || {}}
              onChange={(chave, valor) =>
                setCredenciais((c) => ({ ...c, [emissorDetalhe.id]: { ...(c[emissorDetalhe.id] || {}), [chave]: valor } }))
              }
              bloqueio={motivoBloqueio(emissorDetalhe)}
              salvando={salvando}
              onSalvar={() =>
                salvar({ credenciais: { [emissorDetalhe.id]: credenciais[emissorDetalhe.id] || {} } }, "Credenciais salvas neste computador.")
              }
            />
          )}
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Dados fiscais da empresa */}
      <Typography variant="subtitle1" fontWeight={600}>Dados fiscais da empresa</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Usados pelos emissores integrados. Confirme cada campo com seu contador.
      </Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><TextField label="CNPJ" {...campoEmpresa("cnpj")} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField label="Inscrição municipal" {...campoEmpresa("inscricaoMunicipal")} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField label="Inscrição estadual" {...campoEmpresa("inscricaoEstadual")} helperText="Para NF-e/NFC-e" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Regime tributário</InputLabel>
            <Select
              label="Regime tributário"
              value={empresa.regimeTributario || ""}
              onChange={(ev) => setEmpresa((e) => ({ ...e, regimeTributario: ev.target.value }))}
              disabled={salvando}
            >
              <MenuItem value=""><em>Não informado</em></MenuItem>
              {REGIMES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField label="Código IBGE do município" {...campoEmpresa("codigoMunicipioIbge")} helperText="7 dígitos" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><TextField label="Alíquota do ISS (%)" {...campoEmpresa("aliquotaIss")} /></Grid>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField label="Código de tributação do serviço (padrão)" {...campoEmpresa("codigoTributacao")} helperText="Código de tributação nacional/municipal informado pelo contador" />
        </Grid>
      </Grid>
      <Box sx={{ mt: 1.5, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="outlined" disabled={salvando} onClick={() => salvar({ empresa }, "Dados fiscais salvos.")}>
          Salvar dados fiscais
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Certificado digital */}
      <Typography variant="subtitle1" fontWeight={600}>Certificado digital A1</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Necessário para emitir direto pelo Emissor Nacional. Na Notaas e na Focus NFe o certificado é enviado ao painel
        deles; no Registro manual não é preciso. O arquivo fica cifrado <strong>somente neste computador</strong>.
      </Typography>
      {cert ? (
        <Card variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <VerifiedUserIcon color={diasCert <= 30 ? "warning" : "success"} />
              <Typography fontWeight={600}>{cert.titular || "Certificado cadastrado"}</Typography>
              <Chip
                size="small"
                color={diasCert <= 0 ? "error" : diasCert <= 30 ? "warning" : "success"}
                label={diasCert <= 0 ? "Vencido" : `Vence em ${diasCert} dia(s)`}
              />
            </Stack>
            <Grid container spacing={1}>
              <Grid size={{ xs: 12, sm: 4 }}><Typography variant="body2" color="text.secondary">{cert.documento?.tipo || "Documento"}</Typography><Typography variant="body2">{formatarDocumento(cert.documento)}</Typography></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><Typography variant="body2" color="text.secondary">Válido até</Typography><Typography variant="body2">{formatarData(cert.validoAte)}</Typography></Grid>
              <Grid size={{ xs: 12, sm: 4 }}><Typography variant="body2" color="text.secondary">Autoridade certificadora</Typography><Typography variant="body2">{cert.emissor || "—"}</Typography></Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              Arquivo {cert.arquivoNome} · cadastrado em {formatarData(cert.cadastradoEm)}{cert.cadastradoPor ? ` por ${cert.cadastradoPor}` : ""}
            </Typography>
          </CardContent>
          <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
            <Button color="error" size="small" onClick={() => setConfirmarRemocao(true)}>Remover certificado</Button>
          </CardActions>
        </Card>
      ) : (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "flex-start" }}>
          <Button variant="outlined" onClick={selecionarCertificado} disabled={!termoAceito || salvando} sx={{ flexShrink: 0, mt: { sm: 0.25 } }}>
            {certArquivo ? "Trocar arquivo" : "Selecionar arquivo (.pfx)"}
          </Button>
          <TextField
            label="Senha do certificado"
            type="password"
            size="small"
            value={certSenha}
            onChange={(e) => setCertSenha(e.target.value)}
            disabled={!certArquivo || salvando}
            helperText={certArquivo ? certArquivo.nome : !termoAceito ? "Aceite \"Como funciona a emissão\" para cadastrar" : "Nenhum arquivo selecionado"}
            autoComplete="new-password"
          />
          <Button variant="contained" onClick={cadastrarCertificado} disabled={!certArquivo || salvando} sx={{ flexShrink: 0, mt: { sm: 0.25 } }}>
            Cadastrar certificado
          </Button>
        </Stack>
      )}

      <ConfirmDialog
        open={confirmarRemocao}
        onCancel={() => setConfirmarRemocao(false)}
        onConfirm={removerCertificado}
        title="Remover certificado"
        message="O certificado e a senha serão apagados deste computador. Emissores que dependem dele deixarão de emitir até um novo cadastro."
      />
    </Paper>
  );
}

function FormCredenciais({ emissor, salvas, valores, onChange, bloqueio, salvando, onSalvar }) {
  const desabilitado = !!bloqueio || salvando;
  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Credenciais (cadastradas por você)</Typography>
      {bloqueio && <Alert severity="info" sx={{ mb: 1.5 }}>{bloqueio}</Alert>}
      <Grid container spacing={2}>
        {emissor.credenciais.map((campo) => (
          <Grid size={{ xs: 12, sm: 6 }} key={campo.chave}>
            {campo.tipo === "selecao" ? (
              <FormControl fullWidth size="small" disabled={desabilitado}>
                <InputLabel>{campo.rotulo}</InputLabel>
                <Select
                  label={campo.rotulo}
                  value={valores[campo.chave] ?? salvas[campo.chave] ?? ""}
                  onChange={(e) => onChange(campo.chave, e.target.value)}
                >
                  {campo.opcoes.map(([valor, rotulo]) => <MenuItem key={valor} value={valor}>{rotulo}</MenuItem>)}
                </Select>
              </FormControl>
            ) : (
              <TextField
                fullWidth
                size="small"
                type={campo.tipo === "segredo" ? "password" : "text"}
                label={campo.rotulo}
                value={valores[campo.chave] ?? (campo.tipo === "segredo" ? "" : salvas[campo.chave] ?? "")}
                onChange={(e) => onChange(campo.chave, e.target.value)}
                disabled={desabilitado}
                autoComplete="new-password"
                placeholder={campo.tipo === "segredo" && salvas[campo.chave]?.preenchido ? "•••••••• (cadastrada — digite para substituir)" : ""}
                helperText={campo.ajuda}
              />
            )}
          </Grid>
        ))}
      </Grid>
      <Box sx={{ mt: 1.5, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="outlined" onClick={onSalvar} disabled={desabilitado}>Salvar credenciais</Button>
      </Box>
    </Box>
  );
}
