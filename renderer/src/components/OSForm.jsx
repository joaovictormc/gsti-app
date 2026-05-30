import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Autocomplete,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const toLocalISOString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const tzoffset = d.getTimezoneOffset() * 60000;
  const localISOTime = new Date(d - tzoffset).toISOString().slice(0, 16);
  return localISOTime;
};

// --- CORREÇÃO: Inicializa campos de texto com '' ---
const BLANK_OS = {
  id_cliente: null,
  tipo_equipamento: "Notebook",
  marca: "",
  modelo: "",
  numero_serie: "",
  defeito_relatado: "",
  observacoes_entrada: "",
  laudo_tecnico: "",
  solucao_aplicada: "",
  status: "Orçamento",
  data_entrada: toLocalISOString(new Date()),
  data_prevista: "",
  garantia_dias: 90,
};

const nullToString = (value) =>
  value === null || value === undefined ? "" : String(value);

function OSForm({ initialData, onSave, onClose }) {
  const [osData, setOsData] = useState(BLANK_OS);
  const [activeData, setActiveData] = useState({ customers: [], products: [] });
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedCustomerValue, setSelectedCustomerValue] = useState(null); // Mantém o objeto do cliente

  const isEditing = initialData && initialData.os && initialData.os.id;

  // Busca dados ativos (clientes, produtos)
  useEffect(() => {
    const fetchActiveData = async () => {
      const result = await window.api.getActiveData();
      if (result.success) setActiveData(result);
    };
    fetchActiveData();
  }, []);

  // Popula/Reseta o formulário
  useEffect(() => {
    // Só executa se os dados ativos JÁ estiverem carregados
    if (activeData.customers.length > 0 || !isEditing) {
      if (isEditing) {
        const osFromDb = initialData.os;
        const osToEdit = Object.keys(BLANK_OS).reduce(
          (acc, key) => {
            if (key === "data_entrada")
              acc[key] = toLocalISOString(osFromDb[key]);
            else if (key === "data_prevista") acc[key] = osFromDb[key] ? toLocalISOString(osFromDb[key]) : "";
            else if (key === "garantia_dias") acc[key] = osFromDb[key] || 90;
            else if (key === "tipo_equipamento")
              acc[key] = nullToString(osFromDb[key]) || "Notebook";
            else if (key === "status")
              acc[key] = nullToString(osFromDb[key]) || "Orçamento";
            else acc[key] = nullToString(osFromDb[key]);
            return acc;
          },
          { id: osFromDb.id, id_cliente: osFromDb.id_cliente || null }
        );

        setOsData(osToEdit);

        // --- CORREÇÃO ROBUSTA para Autocomplete Cliente ---
        // Tenta encontrar o cliente APENAS se a lista já carregou E temos um id_cliente
        if (activeData.customers.length > 0 && osToEdit.id_cliente !== null) {
          const customer = activeData.customers.find(
            (c) => c.id === osToEdit.id_cliente
          );
          setSelectedCustomerValue(customer || null); // Define o OBJETO encontrado
        } else {
          // Se a lista não carregou ainda ou não há cliente, define como null
          setSelectedCustomerValue(null);
        }
        // --- FIM CORREÇÃO ---

        const itemsToEdit = initialData.items.map((item) => ({
          ...item,
          quantidade: item.quantidade || 1,
          temp_id: Date.now() + Math.random(),
        }));
        setSelectedItems(itemsToEdit);
      } else {
        setOsData(BLANK_OS);
        setSelectedItems([]);
        setSelectedCustomerValue(null); // Reseta Autocomplete
      }
    }
    // Agora depende de activeData.customers para garantir que a lista exista antes de procurar
  }, [initialData, isEditing, activeData.customers]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setOsData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleCustomerChange = useCallback((event, newValue) => {
    setSelectedCustomerValue(newValue);
    setOsData((prev) => ({
      ...prev,
      id_cliente: newValue ? newValue.id : null,
    }));
  }, []);

  const handleAddItem = () => {
    if (selectedProduct) {
      const newItem = {
        ...selectedProduct,
        temp_id: Date.now(),
        quantidade: 1,
      };
      setSelectedItems([...selectedItems, newItem]);
    }
    setSelectedProduct(null);
  };

  const handleQuantityChange = (temp_id, newQuantity) => {
    const quantity = parseInt(newQuantity, 10);
    setSelectedItems((items) =>
      items.map((item) =>
        item.temp_id === temp_id
          ? {
              ...item,
              quantidade: isNaN(quantity) || quantity < 1 ? 1 : quantity,
            }
          : item
      )
    );
  };

  const handleRemoveItem = (temp_id) => {
    setSelectedItems((items) =>
      items.filter((item) => item.temp_id !== temp_id)
    );
  };

  const calculateTotal = () => {
    return selectedItems.reduce((sum, item) => {
      const valor = Number(item.valor) || 0;
      const qtd = Number(item.quantidade) || 1;
      return sum + valor * qtd;
    }, 0);
  };

  // --- CORREÇÃO: Validação ajustada ---
  const handleSubmit = () => {
    if (!osData.id_cliente) {
      alert("O campo Cliente é obrigatório.");
      return;
    }
    // Verifica se pelo menos um dos campos de equipamento está preenchido
    if (!osData.tipo_equipamento && !osData.marca && !osData.modelo) {
      alert("Preencha pelo menos o Tipo, Marca ou Modelo do equipamento.");
      return;
    }
    const total = calculateTotal();
    onSave(osData, selectedItems, total);
  };
  // --- FIM CORREÇÃO ---

  const total = calculateTotal();
  // selectedCustomer não é mais necessário aqui, usamos selectedCustomerValue

  return (
    <>
      <Typography variant="h6" component="h2">
        {isEditing ? `Editar OS Nº ${osData.id}` : "Nova OS"}
      </Typography>

      {/* Autocomplete usa o estado 'selectedCustomerValue' */}
      <Autocomplete
        value={selectedCustomerValue}
        options={activeData.customers}
        getOptionLabel={(option) => (option ? option.nome : "")}
        isOptionEqualToValue={(option, value) => option?.id === value?.id}
        onChange={handleCustomerChange}
        renderInput={(params) => (
          <TextField {...params} label="Cliente" margin="normal" required />
        )}
        // ReadOnly se estiver editando, permite seleção ao criar
        readOnly={isEditing}
      />

      {/* Campos de Equipamento */}
      <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: 'wrap' }}>
        <FormControl fullWidth margin="normal">
          <InputLabel>Tipo de Equipamento</InputLabel>
          <Select
            name="tipo_equipamento"
            value={osData.tipo_equipamento}
            label="Tipo de Equipamento"
            onChange={handleInputChange}
          >
            <MenuItem value="Notebook">Notebook</MenuItem>
            <MenuItem value="Desktop">Desktop</MenuItem>
            <MenuItem value="Impressora">Impressora</MenuItem>
            <MenuItem value="Outro">Outro</MenuItem>
          </Select>
        </FormControl>
        <TextField
          name="marca"
          label="Marca"
          value={osData.marca}
          onChange={handleInputChange}
          fullWidth
          margin="normal"
        />
        <TextField
          name="modelo"
          label="Modelo"
          value={osData.modelo}
          onChange={handleInputChange}
          fullWidth
          margin="normal"
        />
      </Box>
      {/* Status e Data */}
      <Box sx={{ display: "flex", gap: 2, mt: 1, flexWrap: 'wrap' }}>
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            name="status"
            value={osData.status}
            label="Status"
            onChange={handleInputChange}
          >
            <MenuItem value="Orçamento">Orçamento</MenuItem>{" "}
            <MenuItem value="Aguardando Autorização">Aguardando Autorização</MenuItem>{" "}
            <MenuItem value="Em Aberto">Em Aberto</MenuItem>{" "}
            <MenuItem value="Aguardando Peça">Aguardando Peça</MenuItem>{" "}
            <MenuItem value="Em Andamento">Em Andamento</MenuItem>
            <MenuItem value="Finalizado">Finalizado</MenuItem>{" "}
            <MenuItem value="Entregue">Entregue</MenuItem>{" "}
            <MenuItem value="Cancelado">Cancelado</MenuItem>
          </Select>
        </FormControl>
        <TextField
          name="data_entrada"
          label="Data de Entrada"
          type="datetime-local"
          value={osData.data_entrada}
          onChange={handleInputChange}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      <TextField
        name="data_prevista"
        label="Data Prevista de Entrega (opcional)"
        type="datetime-local"
        value={osData.data_prevista}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        InputLabelProps={{ shrink: true }}
      />

      <TextField
        name="numero_serie"
        label="Nº de Série"
        value={osData.numero_serie}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
      />
      <TextField
        name="defeito_relatado"
        label="Defeito Relatado"
        value={osData.defeito_relatado}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        multiline
        rows={3}
      />
      <TextField
        name="observacoes_entrada"
        label="Observações de Entrada"
        value={osData.observacoes_entrada}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        multiline
        rows={2}
      />

      {/* --- ALTERAÇÃO PRINCIPAL: Campos agora são desabilitados em vez de removidos --- */}
      <Typography variant="h6" sx={{ mt: 2 }}>
        Laudo e Solução
      </Typography>
      <TextField
        name="laudo_tecnico"
        label="Laudo Técnico (Diagnóstico)"
        value={osData.laudo_tecnico}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        multiline
        rows={3}
        disabled={
          !["Em Andamento", "Finalizado", "Entregue"].includes(osData.status)
        }
      />
      <TextField
        name="solucao_aplicada"
        label="Solução Aplicada (Serviços realizados)"
        value={osData.solucao_aplicada}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        multiline
        rows={3}
        disabled={
          !["Em Andamento", "Finalizado", "Entregue"].includes(osData.status)
        }
      />
      <TextField
        name="garantia_dias"
        label="Garantia (dias)"
        type="number"
        value={osData.garantia_dias}
        onChange={handleInputChange}
        fullWidth
        margin="normal"
        InputProps={{ inputProps: { min: 0 } }}
        disabled={!["Finalizado", "Entregue"].includes(osData.status)}
      />
      {/* --- FIM DA ALTERAÇÃO --- */}

      <Typography variant="h6" sx={{ mt: 2 }}>
        Itens
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
        <Autocomplete
          sx={{ flexGrow: 1 }}
          options={activeData.products}
          getOptionLabel={(option) =>
            option
              ? `${option.descricao} - R$ ${Number(option.valor).toFixed(2)}`
              : ""
          }
          isOptionEqualToValue={(option, value) => option?.id === value?.id}
          value={selectedProduct}
          onChange={(e, newValue) => setSelectedProduct(newValue)}
          renderInput={(params) => (
            <TextField {...params} label="Adicionar Item" />
          )}
        />
        <Button
          variant="outlined"
          onClick={handleAddItem}
          disabled={!selectedProduct}
        >
          Adicionar
        </Button>
      </Box>
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell align="right" sx={{ width: 80 }}>
                Qtd.
              </TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedItems.map((item) => (
              <TableRow key={item.temp_id}>
                <TableCell>{item.descricao}</TableCell>
                <TableCell align="right">
                  <TextField
                    type="number"
                    size="small"
                    value={item.quantidade}
                    onChange={(e) =>
                      handleQuantityChange(item.temp_id, e.target.value)
                    }
                    inputProps={{
                      min: 1,
                      style: { textAlign: "right", width: "60px" },
                    }}
                  />
                </TableCell>
                <TableCell align="right">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(item.valor)}
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveItem(item.temp_id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell colSpan={2} align="right">
                <strong>Total</strong>
              </TableCell>
              <TableCell colSpan={2} align="right">
                <strong>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(total)}
                </strong>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>

      <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
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

export default OSForm;
