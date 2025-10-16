import { useState, useEffect } from "react";
import { Box, Button, Typography, Modal } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import OSForm from "./OSForm"; // <-- Importe o novo formulário

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 600, // Aumente a largura para o formulário
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
  maxHeight: '90vh', // Adiciona um limite de altura
  overflowY: 'auto', // Adiciona scroll se o conteúdo for muito grande
};

function OSGrid() {
  const [osList, setOSList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchOSList = async () => {
    const data = await window.api.getOSList();
    setOSList(data);
  };

  useEffect(() => {
    fetchOSList();
  }, []);

  const handleOpenAddModal = () => setIsModalOpen(true);
  const handleCloseModal = () => setIsModalOpen(false);

  const handleSaveOS = async (osData, items) => {
    // 1. Primeiro, cria a OS principal
    const osResult = await window.api.addOS(osData);

    if (osResult.success) {
      const osId = osResult.osId;
      // 2. Se a OS foi criada, adiciona os itens a ela
      const itemsResult = await window.api.addOSItems({ osId, items });
      if (itemsResult.success) {
        handleCloseModal();
        fetchOSList(); // Atualiza a lista
      } else {
        alert(`Erro ao adicionar itens à OS: ${itemsResult.error}`);
      }
    } else {
      alert(`Erro ao criar OS: ${osResult.error}`);
    }
  };

  const columns = [
    { field: "id", headerName: "OS Nº", width: 90 },
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 200 },
    { field: "equipamento_descricao", headerName: "Equipamento", flex: 1, minWidth: 250 },
    {
      field: "data_entrada",
      headerName: "Data de Entrada",
      width: 180,
      valueFormatter: (params) => {
        if (!params.value) return "";
        return new Date(params.value).toLocaleString("pt-BR");
      },
    },
    { field: "status", headerName: "Status", width: 150 },
    // Ações virão depois
  ];

  return (
    <>
      <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          Ordens de Serviço
        </Typography>
        <Button variant="contained" onClick={handleOpenAddModal}>
          Adicionar Nova OS
        </Button>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={osList}
          columns={columns}
          getRowId={(row) => row.id}
          localeText={{ noRowsLabel: "Nenhuma Ordem de Serviço encontrada." }}
        />
      </Box>

      <Modal open={isModalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          <OSForm onSave={handleSaveOS} onClose={handleCloseModal} />
        </Box>
      </Modal>
    </>
  );
}

export default OSGrid;