import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel,
  Stack, Switch, TextField, Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/LockOutlined";
import { get, put } from "../api";
import { dataHora } from "../format";
import { Carregando } from "../components/comum";

function Campo({ campo, valor, onChange }) {
  const doServidor = campo.origem === "ambiente";

  if (campo.tipo === "booleano") {
    return (
      <FormControlLabel
        control={<Switch checked={!!valor} onChange={(e) => onChange(e.target.checked)} disabled={doServidor} />}
        label={<>{campo.rotulo}{doServidor && <Chip size="small" label="definido no servidor" sx={{ ml: 1 }} />}</>}
      />
    );
  }

  const segredo = campo.tipo === "segredo";
  const preenchido = !!campo.valor;
  return (
    <TextField
      label={campo.rotulo}
      value={valor ?? ""}
      onChange={(e) => onChange(e.target.value)}
      type={campo.tipo === "numero" ? "number" : "text"}
      fullWidth
      disabled={doServidor}
      placeholder={segredo && preenchido ? campo.valor : ""}
      helperText={
        doServidor
          ? `Definido por variável de ambiente no servidor — altere lá. Valor atual: ${campo.valor || "—"}`
          : segredo && preenchido
            ? `Já configurado (${campo.valor}). Deixe em branco para manter.${campo.ajuda ? ` ${campo.ajuda}` : ""}`
            : campo.ajuda || " "
      }
      slotProps={{ htmlInput: { maxLength: campo.max || 400, autoComplete: "off", spellCheck: false } }}
    />
  );
}

export default function ConfigCredenciais({ aberto, onFechar, onSalvo }) {
  const [grupos, setGrupos] = useState(null);
  const [valores, setValores] = useState({});
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setErro(""); setOk(""); setSenha(""); setGrupos(null);
    get("/sistema/config")
      .then((r) => {
        setGrupos(r.grupos);
        const iniciais = {};
        for (const g of r.grupos) {
          for (const c of g.campos) {
            iniciais[c.nome] = c.tipo === "booleano" ? c.valor === "Sim" : c.valorEditavel;
          }
        }
        setValores(iniciais);
      })
      .catch((e) => setErro(e.message));
  }, [aberto]);

  const salvar = async () => {
    setErro(""); setOk(""); setSalvando(true);
    try {
      const enviar = {};
      for (const g of grupos) {
        for (const c of g.campos) {
          if (c.origem === "ambiente") continue;
          const v = valores[c.nome];
          if (c.tipo === "segredo" && !String(v || "").trim()) continue; // manter
          enviar[c.nome] = v;
        }
      }
      const r = await put("/sistema/config", { senha, valores: enviar });
      setGrupos(r.grupos);
      setSenha("");
      setOk(r.alterados.length ? "Configurações salvas." : "Nada foi alterado.");
      onSalvo?.();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const limpar = (nome) => setValores((v) => ({ ...v, [nome]: "__limpar__" }));

  return (
    <Dialog open={aberto} onClose={() => !salvando && onFechar()} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <LockIcon fontSize="small" /> Credenciais do sistema
      </DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          Os valores são guardados cifrados no servidor e nunca são exibidos de volta — só os últimos dígitos.
          Alterações valem imediatamente, sem reiniciar o serviço.
        </Alert>
        {!grupos ? <Carregando /> : (
          <Stack spacing={3} divider={<Divider flexItem />}>
            {grupos.map((g) => (
              <Box key={g.grupo}>
                <Typography variant="h6">{g.titulo}</Typography>
                {g.ajuda && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{g.ajuda}</Typography>}
                <Stack spacing={2}>
                  {g.campos.map((c) => (
                    <Box key={c.nome}>
                      <Campo campo={c} valor={valores[c.nome]} onChange={(v) => setValores((atual) => ({ ...atual, [c.nome]: v }))} />
                      {c.origem === "painel" && c.tipo !== "booleano" && (
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">
                            Alterado por {c.atualizadoPor} em {dataHora(c.atualizadoEm)}
                          </Typography>
                          <Button size="small" color="error" onClick={() => limpar(c.nome)} disabled={valores[c.nome] === "__limpar__"}>
                            {valores[c.nome] === "__limpar__" ? "Será removido ao salvar" : "Remover"}
                          </Button>
                        </Stack>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Box>
            ))}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Confirme com a sua senha</Typography>
              <TextField
                label="Sua senha do painel" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
                fullWidth autoComplete="current-password"
              />
            </Box>
            {erro && <Alert severity="error">{erro}</Alert>}
            {ok && <Alert severity="success">{ok}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={salvando}>Fechar</Button>
        <Button variant="contained" onClick={salvar} disabled={salvando || !grupos || !senha}>
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
