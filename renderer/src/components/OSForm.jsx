import { useState, useEffect } from "react";
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

const BLANK_OS = {
  id_cliente: null,
  // Novos campos de equipamento
  tipo_equipamento: "Notebook",
  marca: "",
  modelo: "",
  numero_serie: "",
  defeito_relatado: "",
  observacoes_entrada: "",
  // Novos campos de laudo
  laudo_tecnico: "",
  solucao_aplicada: "",
  status: "Orçamento",
  data_entrada: toLocalISOString(new Date()),
  garantia_dias: 90,
};

// Função auxiliar para garantir que null vira ''
const nullToString = (value) =>
  value === null || value === undefined ? "" : value;

function OSForm({ initialData, onSave, onClose }) {
  const [osData, setOsData] = useState(BLANK_OS);
  const [activeData, setActiveData] = useState({ customers: [], products: [] });
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const isEditing = initialData && initialData.os && initialData.os.id;

  useEffect(() => {
    const fetchData = async () => {
      const result = await window.api.getActiveData();
      if (result.success) {
        setActiveData(result);
        if (isEditing) {
          // --- CORREÇÃO: Garante que todos os campos sejam strings vazias se forem null ---
          const osFromDb = initialData.os;
          const osToEdit = {
            ...osFromDb,
            // Garante que campos de texto não sejam null
            tipo_equipamento:
              nullToString(osFromDb.tipo_equipamento) || "Notebook", // Garante valor válido
            marca: nullToString(osFromDb.marca),
            modelo: nullToString(osFromDb.modelo),
            numero_serie: nullToString(osFromDb.numero_serie),
            defeito_relatado: nullToString(osFromDb.defeito_relatado),
            observacoes_entrada: nullToString(osFromDb.observacoes_entrada),
            laudo_tecnico: nullToString(osFromDb.laudo_tecnico),
            solucao_aplicada: nullToString(osFromDb.solucao_aplicada),
            status: nullToString(osFromDb.status) || "Orçamento", // Garante valor válido
            data_entrada: toLocalISOString(osFromDb.data_entrada),
            garantia_dias: osFromDb.garantia_dias || 90,
          };
          setOsData(osToEdit);
          const itemsToEdit = initialData.items.map((item) => ({
            ...item,
            quantidade: item.quantidade || 1,
            temp_id: Date.now() + Math.random(),
          }));
          setSelectedItems(itemsToEdit);
        } else {
          // Garante reset completo
          setOsData(BLANK_OS);
          setSelectedItems([]);
        }
      }
    };
    fetchData();
  }, [initialData, isEditing]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setOsData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomerChange = (event, newValue) => {
    setOsData((prev) => ({
      ...prev,
      id_cliente: newValue ? newValue.id : null,
    }));
  };

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

  const handleSubmit = () => {
    if (!osData.id_cliente || !osData.equipamento_descricao) {
      // Adicionado check de equipamento
      alert("Cliente e Descrição do Equipamento são obrigatórios.");
      return;
    }
    const total = calculateTotal();
    onSave(osData, selectedItems, total);
  };

  const total = calculateTotal();
  const selectedCustomer =
    activeData.customers.find((c) => c.id === osData.id_cliente) || null;

  return (
    <>
      <Typography variant="h6" component="h2">
        {isEditing ? `Editar OS Nº ${osData.id}` : "Nova OS"}
      </Typography>

      {/* Autocomplete e Campos de Equipamento (sem alterações) */}
      <Autocomplete
        value={selectedCustomer}
        options={activeData.customers}
        getOptionLabel={(option) => option.nome || ""}
        onChange={handleCustomerChange}
        renderInput={(params) => (
          <TextField {...params} label="Cliente" margin="normal" required />
        )}
        readOnly={isEditing} // Usar readOnly em vez de disabled para evitar bloqueio
      />
      <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
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
      <Box sx={{ display: "flex", gap: 2, mt: 1 }}>
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select
            name="status"
            value={osData.status}
            label="Status"
            onChange={handleInputChange}
          >
            <MenuItem value="Orçamento">Orçamento</MenuItem>{" "}
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

      {["Finalizado", "Entregue"].includes(osData.status) && (
        <TextField
          name="garantia_dias"
          label="Garantia (dias)"
          type="number"
          value={osData.garantia_dias}
          onChange={handleInputChange}
          fullWidth
          margin="normal"
          InputProps={{ inputProps: { min: 0 } }}
        />
      )}

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

      {["Em Andamento", "Finalizado", "Entregue"].includes(osData.status) && (
        <>
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
          />
        </>
      )}

      <Typography variant="h6" sx={{ mt: 2 }}>
        Itens
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
        <Autocomplete
          sx={{ flexGrow: 1 }}
          options={activeData.products}
          getOptionLabel={(option) =>
            `${option.descricao} - R$ ${Number(option.valor).toFixed(2)}` || ""
          }
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
          {/* JSX da Tabela sem espaços extras */}
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
            {/* Linha Total sem espaços extras */}
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
