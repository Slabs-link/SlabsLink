import React, { useState } from 'react';
import { Box, Typography, Container, Button, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, Menu, MenuItem, Pagination } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Sidebar from '../common/Sidebar';

interface Patient {
  id: string;
  name: string;
  fiscalCode: string;
  contact: {
    phone: string;
    email: string;
  };
  lastAppointment: string;
  nextAppointment: string;
}

const Patients: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  
  // Mock data
  const patients: Patient[] = [
    {
      id: '1',
      name: 'Marco Rossi',
      fiscalCode: 'RSSMRC80M01H501U',
      contact: {
        phone: '+39 333 1234567',
        email: 'marco.rossi@esempio.com'
      },
      lastAppointment: '16/05/2023',
      nextAppointment: '15/06/2023'
    }
  ];
  
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, patientId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedPatient(patientId);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPatient(null);
  };
  
  const handleViewDetails = () => {
    // Logic to view patient details
    handleMenuClose();
  };
  
  const handleEditPatient = () => {
    // Logic to edit patient
    handleMenuClose();
  };
  
  const handleDeletePatient = () => {
    // Logic to delete patient
    handleMenuClose();
  };
  
  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" fontWeight="bold">Pazienti</Typography>
            
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              color="primary"
            >
              Aggiungi Paziente
            </Button>
          </Box>
          
          {/* Search Bar */}
          <Box sx={{ mb: 4 }}>
            <TextField
              fullWidth
              placeholder="Cerca per nome, codice fiscale, email o telefono..."
              variant="outlined"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
            />
          </Box>
          
          {/* Patients Table */}
          <TableContainer component={Paper} sx={{ mb: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Codice Fiscale</TableCell>
                  <TableCell>Contatto</TableCell>
                  <TableCell>Ultimo Appuntamento</TableCell>
                  <TableCell>Prossimo Appuntamento</TableCell>
                  <TableCell align="right">Azioni</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>{patient.name}</TableCell>
                    <TableCell>{patient.fiscalCode}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{patient.contact.phone}</Typography>
                      <Typography variant="body2" color="text.secondary">{patient.contact.email}</Typography>
                    </TableCell>
                    <TableCell>{patient.lastAppointment}</TableCell>
                    <TableCell>{patient.nextAppointment}</TableCell>
                    <TableCell align="right">
                      <IconButton onClick={(e) => handleMenuOpen(e, patient.id)}>
                        <MoreVertIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Visualizzazione 1 a 1 di 1 paziente
            </Typography>
            <Pagination count={1} color="primary" />
          </Box>
          
          {/* Actions Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleViewDetails}>
              <VisibilityIcon fontSize="small" sx={{ mr: 1 }} />
              Visualizza Dettagli
            </MenuItem>
            <MenuItem onClick={handleEditPatient}>
              <EditIcon fontSize="small" sx={{ mr: 1 }} />
              Modifica
            </MenuItem>
            <MenuItem onClick={handleDeletePatient} sx={{ color: 'error.main' }}>
              <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
              Elimina
            </MenuItem>
          </Menu>
        </Container>
      </Box>
    </Box>
  );
};

export default Patients;