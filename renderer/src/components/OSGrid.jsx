import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Typography,
  Modal,
  TextField,
  IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import OSForm from "./OSForm";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 600,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
  maxHeight: "90vh",
  overflowY: "auto",
};

function OSGrid() {
  const [osList, setOSList] = useState([]);
  const [filteredOSList, setFilteredOSList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOS, setEditingOS] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalKey, setModalKey] = useState(0);

  const fetchOSList = async () => {
    const data = await window.api.getOSList();
    setOSList(data);
    setFilteredOSList(data);
  };

  useEffect(() => {
    fetchOSList();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    if (!term) {
      setFilteredOSList(osList);
    } else {
      const filteredData = osList.filter(
        (item) =>
          item.nome_cliente && item.nome_cliente.toLowerCase().includes(term)
      );
      setFilteredOSList(filteredData);
    }
  }, [searchTerm, osList]);

  const handleOpenAddModal = () => {
    setEditingOS(null);
    setModalKey((prevKey) => prevKey + 1); // Muda a chave
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (osId) => {
    const result = await window.api.getOSDetails(osId);
    if (result.success) {
      setEditingOS(result);
      setModalKey((prevKey) => prevKey + 1); // Muda a chave
      setIsModalOpen(true);
    } else {
      alert(`Erro ao buscar detalhes: ${result.error}`);
    }
  };

  const handleDeleteOS = async (osId) => {
    if (window.confirm(`Tem certeza que deseja excluir a OS Nº ${osId}?`)) {
      const result = await window.api.deleteOS(osId);
      if (result.success) fetchOSList();
      else alert(`Erro ao excluir: ${result.error}`);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOS(null);
  };

  const handleSaveOS = async (osData, items, total) => {
    const isEditing = !!osData.id;

    if (isEditing) {
      const osPromise = window.api.updateOS({ osData, total });
      const itemsPromise = window.api.updateOSItems({ osId: osData.id, items });
      const [osResult] = await Promise.all([osPromise, itemsPromise]);
      if (!osResult.success) alert(`Erro ao salvar OS: ${osResult.error}`);
    } else {
      const osResult = await window.api.addOS({ osData, total });
      if (osResult.success) {
        await window.api.addOSItems({ osId: osResult.osId, items });
      } else {
        alert(`Erro ao criar OS: ${osResult.error}`);
      }
    }
    handleCloseModal();
    fetchOSList();
  };

  // --- NOVA FUNÇÃO PARA IMPRIMIR ---
  const handlePrintReceipt = async (osId) => {
    const result = await window.api.generateEntryReceipt(osId);
    if (!result.success) {
      alert(`Erro ao gerar PDF: ${result.error}`);
    }
  };

  // --- NOVA FUNÇÃO PARA IMPRIMIR RECIBO DE SAÍDA ---
  const handlePrintExitReceipt = async (osId) => {
    const result = await window.api.generateExitReceipt(osId);
    if (!result.success) {
      alert(`Erro ao gerar PDF de Saída: ${result.error}`);
    } else {
      // Opcional: Atualizar a lista caso a data de saída tenha sido definida agora
      fetchOSList();
    }
  };

  const columns = [
    { field: "id", headerName: "OS Nº", width: 90 },
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 200 },
    // --- COLUNA ATUALIZADA ---
    {
      field: "equipamento", // Usa o campo CONCAT do backend
      headerName: "Equipamento",
      flex: 1,
      minWidth: 250,
    },
    // --- FIM DA ATUALIZAÇÃO ---
    {
      field: "data_entrada",
      headerName: "Data de Entrada",
      width: 180,
      // --- CORREÇÃO DEFINITIVA DA FORMATAÇÃO DE DATA ---
      renderCell: (params) => {
        if (!params.value) return "";
        const date = new Date(params.value);
        if (isNaN(date.getTime())) return "Data Inválida";
        // Formato: DD/MM/AAAA, HH:MM
        return date.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
    { field: "status", headerName: "Status", width: 150 },
    {
      field: "valor_total",
      headerName: "Valor Total",
      width: 150,
      // --- CORREÇÃO DEFINITIVA DA FORMATAÇÃO DE VALOR ---
      renderCell: (params) => {
        const value = Number(params.value);
        if (params.value == null || isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      },
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 200, // <-- Aumente a largura
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton
            onClick={() => handlePrintReceipt(params.row.id)}
            title="Imprimir Comprovante de Entrada"
          >
            <PrintIcon />
          </IconButton>
          {/* --- NOVO BOTÃO CONDICIONAL --- */}
          {["Finalizado", "Entregue"].includes(params.row.status) && (
            <IconButton
              onClick={() => handlePrintExitReceipt(params.row.id)}
              title="Imprimir Recibo de Saída/Garantia"
            >
              <ReceiptLongIcon />
            </IconButton>
          )}
          <IconButton
            onClick={() => handleOpenEditModal(params.row.id)}
            title="Editar OS"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDeleteOS(params.row.id)}
            title="Excluir OS"
          >
            <DeleteIcon />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          Ordens de Serviço
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            variant="outlined"
            label="Buscar por Nome"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 300 }}
          />
          <Button variant="contained" onClick={handleOpenAddModal}>
            Adicionar Nova OS
          </Button>
        </Box>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={filteredOSList}
          columns={columns}
          getRowId={(row) => row.id}
          getRowLabel={(row) =>
            `${row.id} - ${row.nome_cliente} - ${row.equipamento}`
          }
          localeText={{ noRowsLabel: "Nenhuma Ordem de Serviço encontrada." }}
        />
      </Box>
      <Modal open={isModalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          <OSForm
            key={modalKey}
            initialData={editingOS}
            onSave={handleSaveOS}
            onClose={handleCloseModal}
          />
        </Box>
      </Modal>
    </>
  );
}

export default OSGrid;
