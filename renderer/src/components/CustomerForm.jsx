// renderer/src/components/CustomerForm.jsx

import { useState, useEffect, forwardRef } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { IMaskInput } from "react-imask";

// --- Componentes Customizados com Máscara ---
const PhoneMask = forwardRef(function PhoneMask(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="(#0) 00000-0000"
      definitions={{ "#": /[1-9]/ }}
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

const CpfMask = forwardRef(function CpfMask(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="000.000.000-00"
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

const CnpjMask = forwardRef(function CnpjMask(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="00.000.000/0000-00"
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

const CepMask = forwardRef(function CepMask(props, ref) {
  const { onChange, ...other } = props;
  return (
    <IMaskInput
      {...other}
      mask="00000-000"
      inputRef={ref}
      onAccept={(value) => onChange({ target: { name: props.name, value } })}
      overwrite
    />
  );
});

// --- Componente Principal do Formulário ---
export default function CustomerForm({ initialData, onSave, onClose, onValidate }) {
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [cepValue, setCepValue] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState("");
  const [cepAutoFilled, setCepAutoFilled] = useState(false);

  useEffect(() => {
    setFormData(initialData);
    setCepValue("");
    setCepError("");
    setCepAutoFilled(false);
  }, [initialData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "tipo_pessoa") {
        next.cpf_cnpj = "";
        next.nome = "";
        next.endereco = "";
      }
      if (name === "endereco") setCepAutoFilled(false);
      return next;
    });
  };

  const handleValidateCnpj = async () => {
    setLoading(true);
    const result = await onValidate(formData.cpf_cnpj);
    setLoading(false);
    if (result && result.success) {
      const { name, data } = result;
      let fullAddress = "";
      if (data && data.logradouro) {
        fullAddress = `${data.logradouro}, ${data.numero} - ${data.bairro}, ${data.municipio} - ${data.uf}, CEP: ${data.cep}`;
      }
      setFormData((prev) => ({
        ...prev,
        nome: name || prev.nome,
        endereco: fullAddress || prev.endereco,
      }));
    } else if (result) {
      alert(`Aviso: ${result.error}`);
    }
  };

  const cleanCep = cepValue.replace(/\D/g, "");

  const handleSearchCep = async () => {
    if (cleanCep.length !== 8) return;
    setLoadingCep(true);
    setCepError("");
    setCepAutoFilled(false);
    const result = await window.api.searchCep(cleanCep);
    setLoadingCep(false);
    if (result.success) {
      const { logradouro, bairro, localidade, uf } = result.data;
      const parts = [logradouro, bairro, `${localidade} - ${uf}`].filter(Boolean);
      setFormData((prev) => ({ ...prev, endereco: parts.join(", ") }));
      setCepAutoFilled(true);
    } else {
      setCepError(result.error || "CEP não encontrado.");
    }
  };

  const handleSubmit = () => {
    const dataToSave = {
      ...formData,
      cpf_cnpj: String(formData.cpf_cnpj).replace(/\D/g, ""),
      telefone: String(formData.telefone).replace(/\D/g, ""),
    };
    if (!dataToSave.nome || !dataToSave.cpf_cnpj) {
      alert("Os campos de Nome/Razão Social e CPF/CNPJ são obrigatórios.");
      return;
    }
    if (dataToSave.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dataToSave.email)) {
      alert("Informe um email válido.");
      return;
    }
    onSave(dataToSave);
  };

  return (
    <>
      <Typography variant="h6" component="h2">
        {formData.id ? "Editar Cliente" : "Cadastrar Novo Cliente"}
      </Typography>

      <FormControl component="fieldset" margin="normal">
        <FormLabel component="legend">Tipo de Pessoa</FormLabel>
        <RadioGroup
          row
          name="tipo_pessoa"
          value={formData.tipo_pessoa}
          onChange={handleInputChange}
        >
          <FormControlLabel value="Física" control={<Radio />} label="Física" />
          <FormControlLabel value="Jurídica" control={<Radio />} label="Jurídica" />
        </RadioGroup>
      </FormControl>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TextField
          margin="normal"
          required
          fullWidth
          name="cpf_cnpj"
          label={formData.tipo_pessoa === "Física" ? "CPF" : "CNPJ"}
          value={formData.cpf_cnpj}
          onChange={handleInputChange}
          InputProps={{
            inputComponent: formData.tipo_pessoa === "Física" ? CpfMask : CnpjMask,
          }}
        />
        {formData.tipo_pessoa === "Jurídica" && (
          <Button
            variant="outlined"
            onClick={handleValidateCnpj}
            disabled={loading || String(formData.cpf_cnpj).replace(/\D/g, "").length !== 14}
            sx={{ mt: 1, whiteSpace: "nowrap" }}
          >
            {loading ? <CircularProgress size={24} /> : "Validar"}
          </Button>
        )}
      </Box>

      <TextField
        margin="normal"
        required
        fullWidth
        name="nome"
        label={formData.tipo_pessoa === "Física" ? "Nome Completo" : "Razão Social"}
        value={formData.nome}
        onChange={handleInputChange}
      />

      <TextField
        margin="normal"
        fullWidth
        name="telefone"
        label="Telefone"
        value={formData.telefone}
        onChange={handleInputChange}
        InputProps={{ inputComponent: PhoneMask }}
      />

      <TextField
        margin="normal"
        fullWidth
        name="email"
        label="Email"
        value={formData.email}
        onChange={handleInputChange}
      />

      {/* CEP com busca automática */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <TextField
          margin="normal"
          label="CEP"
          name="cep"
          value={cepValue}
          onChange={(e) => {
            setCepValue(e.target.value);
            setCepError("");
            setCepAutoFilled(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && cleanCep.length === 8) handleSearchCep();
          }}
          InputProps={{ inputComponent: CepMask }}
          error={!!cepError}
          helperText={cepError || (cepAutoFilled ? "✓ Endereço preenchido — adicione o número do imóvel." : "")}
          FormHelperTextProps={{
            sx: { color: cepAutoFilled && !cepError ? "success.main" : undefined },
          }}
          sx={{ width: 180, flexShrink: 0 }}
        />
        <Button
          variant="outlined"
          onClick={handleSearchCep}
          disabled={loadingCep || cleanCep.length !== 8}
          sx={{ mt: 2, whiteSpace: "nowrap" }}
          startIcon={
            loadingCep
              ? <CircularProgress size={16} color="inherit" />
              : <SearchIcon />
          }
        >
          {loadingCep ? "Buscando..." : "Buscar CEP"}
        </Button>
      </Box>

      <TextField
        margin="normal"
        fullWidth
        name="endereco"
        label="Endereço"
        value={formData.endereco}
        onChange={handleInputChange}
        helperText={cepAutoFilled ? "Adicione o número do imóvel ao final." : ""}
        multiline
        rows={2}
      />

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={onClose} sx={{ mr: 1 }}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={handleSubmit}>
          Salvar
        </Button>
      </Box>
    </>
  );
}
