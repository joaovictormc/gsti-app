// renderer/src/components/CustomerGrid.jsx

import { Box } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

// Define as colunas que nossa tabela terá. O 'field' deve corresponder
// ao nome da propriedade nos nossos dados (rows).
const columns = [
  { field: 'id', headerName: 'ID', width: 90 },
  { field: 'nome', headerName: 'Nome', width: 250, editable: true },
  { field: 'telefone', headerName: 'Telefone', width: 150, editable: true },
  { field: 'email', headerName: 'Email', width: 250, editable: true },
];

// Dados de exemplo para popular a tabela por enquanto.
// No próximo passo, vamos buscar isso do banco de dados.
const rows = [
  { id: 1, nome: 'João da Silva', telefone: '(28) 99999-0001', email: 'joao.silva@email.com' },
  { id: 2, nome: 'Maria Oliveira', telefone: '(28) 99999-0002', email: 'maria.o@email.com' },
  { id: 3, nome: 'Pedro Martins', telefone: '(27) 98888-1111', email: 'pedro.m@email.com' },
  { id: 4, nome: 'Ana Costa', telefone: '(28) 99988-2222', email: 'ana.costa@email.com' },
];

function CustomerGrid() {
  return (
    <Box sx={{ height: 400, width: '100%', padding: 2 }}>
      <DataGrid
        rows={rows}
        columns={columns}
        pageSize={5}
        rowsPerPageOptions={[5]}
        checkboxSelection
        disableSelectionOnClick
      />
    </Box>
  );
}

export default CustomerGrid;