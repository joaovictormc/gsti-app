import { useState, useEffect } from "react";
import {
  Box, Button, TextField, Typography, Select, MenuItem, InputLabel, FormControl,
  Autocomplete, IconButton, Paper, Table, TableBody, TableCell, TableHead, TableRow
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

// Função para formatar a data para o formato que o input datetime-local espera
const toLocalISOString = (date) => {
  const tzoffset = date.getTimezoneOffset() * 60000; //offset in milliseconds
  const localISOTime = new Date(date - tzoffset).toISOString().slice(0, 16);
  return localISOTime;
};

const BLANK_OS = {
  id_cliente: null,
  equipamento_descricao: "",
  numero_serie: "",
  defeito_relatado: "",
  observacoes_entrada: "",
  status: "Orçamento", // <-- Novo padrão
  data_entrada: toLocalISOString(new Date()), // <-- Novo campo com a data e hora atuais
};

function OSForm({ onSave, onClose }) {
  const [osData, setOsData] = useState(BLANK_OS);
  const [activeData, setActiveData] = useState({ customers: [], products: [] });
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const result = await window.api.getActiveData();
      if (result.success) {
        setActiveData(result);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setOsData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCustomerChange = (event, newValue) => {
    setOsData((prev) => ({ ...prev, id_cliente: newValue ? newValue.id : null }));
  };
  
  const handleAddItem = () => {
    if (selectedProduct && !selectedItems.find(item => item.id === selectedProduct.id)) {
      setSelectedItems([...selectedItems, { ...selectedProduct, quantidade: 1 }]);
    }
    setSelectedProduct(null);
  };
  
  const handleRemoveItem = (itemId) => {
    setSelectedItems(selectedItems.filter(item => item.id !== itemId));
  };
  
  const handleSubmit = () => {
    if (!osData.id_cliente || !osData.equipamento_descricao) {
      alert("Cliente e Descrição do Equipamento são obrigatórios.");
      return;
    }
    onSave(osData, selectedItems);
  };

  const total = selectedItems.reduce((sum, item) => sum + (Number(item.valor) * item.quantidade), 0);

  return (
    <>
      <Typography variant="h6" component="h2">Nova Ordem de Serviço</Typography>
      
      <Autocomplete
        options={activeData.customers}
        getOptionLabel={(option) => option.nome || ""}
        onChange={handleCustomerChange}
        renderInput={(params) => <TextField {...params} label="Selecione um Cliente" margin="normal" required />}
      />

      <TextField name="equipamento_descricao" label="Descrição do Equipamento (ex: Notebook Dell Vostro)" value={osData.equipamento_descricao} onChange={handleInputChange} fullWidth margin="normal" required />
      
      {/* --- CAMPOS ADICIONADOS --- */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <FormControl fullWidth>
          <InputLabel>Status</InputLabel>
          <Select name="status" value={osData.status} label="Status" onChange={handleInputChange}>
            <MenuItem value="Orçamento">Orçamento</MenuItem>
            <MenuItem value="Em Aberto">Em Aberto</MenuItem>
            <MenuItem value="Aguardando Peça">Aguardando Peça</MenuItem>
            <MenuItem value="Em Andamento">Em Andamento</MenuItem>
          </Select>
        </FormControl>
        <TextField
          name="data_entrada"
          label="Data de Entrada"
          type="datetime-local"
          value={osData.data_entrada}
          onChange={handleInputChange}
          fullWidth
          // Isso garante que o label não sobreponha o valor preenchido
          InputLabelProps={{ shrink: true }}
        />
      </Box>
      {/* --- FIM DOS CAMPOS ADICIONADOS --- */}

      <TextField name="numero_serie" label="Número de Série" value={osData.numero_serie} onChange={handleInputChange} fullWidth margin="normal" />
      <TextField name="defeito_relatado" label="Defeito Relatado pelo Cliente" value={osData.defeito_relatado} onChange={handleInputChange} fullWidth margin="normal" multiline rows={3} />
      <TextField name="observacoes_entrada" label="Observações de Entrada (ex: marcas, adesivos)" value={osData.observacoes_entrada} onChange={handleInputChange} fullWidth margin="normal" multiline rows={2} />
      
      <Typography variant="h6" sx={{ mt: 2 }}>Itens (Produtos e Serviços)</Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
          <Autocomplete
              sx={{ flexGrow: 1 }}
              options={activeData.products}
              getOptionLabel={(option) => `${option.descricao} - R$ ${Number(option.valor).toFixed(2)}` || ""}
              value={selectedProduct}
              onChange={(e, newValue) => setSelectedProduct(newValue)}
              renderInput={(params) => <TextField {...params} label="Adicionar Produto ou Serviço" />}
          />
          <Button variant="outlined" onClick={handleAddItem} disabled={!selectedProduct}>Adicionar</Button>
      </Box>

      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell align="right">Valor Unit.</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {selectedItems.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.descricao}</TableCell>
                <TableCell align="right">{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valor)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleRemoveItem(item.id)}><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
             <TableRow>
                <TableCell colSpan={1} align="right"><strong>Total</strong></TableCell>
                <TableCell colSpan={2} align="right"><strong>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}</strong></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
      
      <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={onClose} sx={{ mr: 1 }}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit}>Salvar Ordem de Serviço</Button>
      </Box>
    </>
  );
}

export default OSForm;