import { useState, useEffect, useRef, forwardRef } from "react";
import {
  Alert,
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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import { IMaskInput } from "react-imask";

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

export default function CustomerForm({ initialData, onSave, onClose, onValidate }) {
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [cepValue, setCepValue] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [cepError, setCepError] = useState("");
  const [cepAutoFilled, setCepAutoFilled] = useState(false);
  const [validationError, setValidationError] = useState(null);
  const numeroRef = useRef(null);

  useEffect(() => {
    setFormData(initialData);
    setCepValue(initialData.cep || "");
    setCepError("");
    setCepAutoFilled(false);
    setValidationError(null);
  }, [initialData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "tipo_pessoa") {
        next.cpf_cnpj = "";
        next.nome = "";
        next.logradouro = "";
        next.numero = "";
        next.bairro = "";
        next.cidade = "";
        next.estado = "";
        setCepValue("");
        setCepAutoFilled(false);
      }
      return next;
    });
    setValidationError(null);
  };

  const handleValidateCnpj = async () => {
    setLoading(true);
    const result = await onValidate(formData.cpf_cnpj);
    setLoading(false);
    if (result && result.success) {
      const { name, data } = result;
      setFormData((prev) => ({
        ...prev,
        nome: name || prev.nome,
        logradouro: data?.logradouro || prev.logradouro,
        numero: data?.numero || prev.numero,
        bairro: data?.bairro || prev.bairro,
        cidade: data?.municipio || prev.cidade,
        estado: data?.uf || prev.estado,
      }));
      if (data?.cep) {
        const formatted = data.cep.replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2");
        setCepValue(formatted);
      }
    } else if (result) {
      setValidationError(`Aviso: ${result.error}`);
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
      const { logradouro, bairro, localidade, uf, cep: foundCep } = result.data;
      setFormData((prev) => ({
        ...prev,
        logradouro: logradouro || "",
        bairro: bairro || "",
        cidade: localidade || "",
        estado: uf || "",
      }));
      if (foundCep) setCepValue(foundCep);
      setCepAutoFilled(true);
      setTimeout(() => numeroRef.current?.focus(), 50);
    } else {
      setCepError(result.error || "CEP não encontrado.");
    }
  };

  const handleSubmit = () => {
    if (!formData.nome || !String(formData.cpf_cnpj).replace(/\D/g, "")) {
      setValidationError("Os campos de Nome/Razão Social e CPF/CNPJ são obrigatórios.");
      return;
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setValidationError("Informe um e-mail válido.");
      return;
    }
    const dataToSave = {
      ...formData,
      cep: cepValue,
      cpf_cnpj: String(formData.cpf_cnpj).replace(/\D/g, ""),
      telefone: String(formData.telefone).replace(/\D/g, ""),
    };
    onSave(dataToSave);
  };

  return (
    <>
      <Typography variant="h6" component="h2">
        {formData.id ? "Editar Cliente" : "Cadastrar Novo Cliente"}
      </Typography>

      <FormControl component="fieldset" margin="normal">
        <FormLabel component="legend">Tipo de Pessoa</FormLabel>
        <RadioGroup row name="tipo_pessoa" value={formData.tipo_pessoa} onChange={handleInputChange}>
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
          InputProps={{ inputComponent: formData.tipo_pessoa === "Física" ? CpfMask : CnpjMask }}
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
        label="E-mail"
        value={formData.email}
        onChange={handleInputChange}
      />

      {/* Endereço dividido */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mt: 1 }}>
        <TextField
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
          helperText={cepError || (cepAutoFilled ? "✓ Endereço preenchido." : "")}
          FormHelperTextProps={{ sx: { color: cepAutoFilled && !cepError ? "success.main" : undefined } }}
          sx={{ width: 150, flexShrink: 0 }}
        />
        <Button
          variant="outlined"
          onClick={handleSearchCep}
          disabled={loadingCep || cleanCep.length !== 8}
          sx={{ mt: 0.5, whiteSpace: "nowrap", alignSelf: "flex-start" }}
          startIcon={loadingCep ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
        >
          {loadingCep ? "Buscando..." : "Buscar"}
        </Button>
        <TextField
          label="Logradouro"
          name="logradouro"
          value={formData.logradouro || ""}
          onChange={handleInputChange}
          fullWidth
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <TextField
          label="Número"
          name="numero"
          value={formData.numero || ""}
          onChange={handleInputChange}
          inputRef={numeroRef}
          sx={{ width: 100, flexShrink: 0 }}
        />
        <TextField
          label="Bairro"
          name="bairro"
          value={formData.bairro || ""}
          onChange={handleInputChange}
          fullWidth
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
        <TextField
          label="Cidade"
          name="cidade"
          value={formData.cidade || ""}
          onChange={handleInputChange}
          fullWidth
        />
        <TextField
          label="UF"
          name="estado"
          value={formData.estado || ""}
          onChange={handleInputChange}
          inputProps={{ maxLength: 2, style: { textTransform: "uppercase" } }}
          sx={{ width: 80, flexShrink: 0 }}
        />
      </Box>

      {validationError && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setValidationError(null)}>
          {validationError}
        </Alert>
      )}

      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={onClose} sx={{ mr: 1 }}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit}>Salvar</Button>
      </Box>
    </>
  );
}
