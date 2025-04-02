import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, AlertColor, SelectChangeEvent, Container
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Template } from '../../types/template';
import { styled } from '@mui/material/styles';
import Sidebar from '../common/Sidebar';

// Componenti styled per migliorare il layout
const SectionTitle = styled(Typography)(({ theme }) => ({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontWeight: 'bold',
  marginBottom: theme.spacing(2)
}));

const TemplatesList = styled(TableContainer)(({ theme }) => ({
  overflowY: 'auto',
  maxHeight: '70vh'
}));

const ContentCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column'
}));

const TemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    type: 'custom'
  });
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: AlertColor;
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Carica i template
  const fetchTemplates = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/templates');
      setTemplates(response.data.templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setNotification({
        open: true,
        message: 'Errore durante il caricamento dei template',
        severity: 'error'
      });
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Gestione del dialogo per creare/modificare un template
  const handleOpenDialog = (template?: Template) => {
    if (template) {
      setSelectedTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        content: template.content,
        type: template.type
      });
    } else {
      setSelectedTemplate(null);
      setFormData({
        name: '',
        description: '',
        content: '',
        type: 'custom'
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  // Gestione del dialogo per eliminare un template
  const handleOpenDeleteDialog = (template: Template) => {
    setSelectedTemplate(template);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSelectedTemplate(null);
  };

  // Gestione del form
  // Gestione del form per Select
  const handleSelectChange = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Gestione del form per TextField
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleChange = (event: SelectChangeEvent<string>) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Salva il template
  const handleSaveTemplate = async () => {
    try {
      setNotification({
        open: true,
        message: 'Salvataggio in corso...',
        severity: 'info'
      });

      if (selectedTemplate) {
        // Aggiorna template esistente
        await axios.put(`http://localhost:3001/api/templates/${selectedTemplate.id}`, formData);
        setNotification({
          open: true,
          message: 'Template aggiornato con successo',
          severity: 'success'
        });
      } else {
        // Crea nuovo template
        await axios.post('http://localhost:3001/api/templates', formData);
        setNotification({
          open: true,
          message: 'Template creato con successo',
          severity: 'success'
        });
      }
      
      handleCloseDialog();
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      setNotification({
        open: true,
        message: `Errore durante il salvataggio del template: ${error.response?.data?.message || error.message}`,
        severity: 'error'
      });
    }
  };

  // Elimina il template
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    
    try {
      setNotification({
        open: true,
        message: 'Eliminazione in corso...',
        severity: 'info'
      });

      await axios.delete(`http://localhost:3001/api/templates/${selectedTemplate.id}`);
      
      setNotification({
        open: true,
        message: 'Template eliminato con successo',
        severity: 'success'
      });
      
      handleCloseDeleteDialog();
      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      setNotification({
        open: true,
        message: `Errore durante l'eliminazione del template: ${error.response?.data?.message || error.message}`,
        severity: 'error'
      });
      handleCloseDeleteDialog();
    }
  };

  // Chiudi la notifica
  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <SectionTitle variant="h4">Gestione Template</SectionTitle>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Nuovo Template
            </Button>
          </Box>
          
          {/* Lista Template */}
          <ContentCard>
            <TemplatesList>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Nome</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Descrizione</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Tipo</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.length > 0 ? (
                    templates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                          {template.name}
                        </TableCell>
                        <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                          {template.description || '-'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{template.type}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton 
                            size="small" 
                            color="primary" 
                            onClick={() => handleOpenDialog(template)}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton 
                            size="small" 
                            color="error" 
                            onClick={() => handleOpenDeleteDialog(template)}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        Nessun template disponibile
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TemplatesList>
          </ContentCard>
        </Container>
      </Box>

      {/* Dialog per creare/modificare template */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {selectedTemplate ? 'Modifica Template' : 'Nuovo Template'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ p: 1 }}>
            <TextField
              fullWidth
              margin="normal"
              label="Nome"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
            <TextField
              fullWidth
              margin="normal"
              label="Descrizione"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              multiline
              rows={2}
            />
            <FormControl fullWidth margin="normal">
              <InputLabel id="template-type-label">Tipo</InputLabel>
              <Select
                labelId="template-type-label"
                name="type"
                value={formData.type}
                label="Tipo"
                onChange={handleSelectChange}
              >
                <MenuItem value="custom">Personalizzato</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="sms">SMS</MenuItem>
                <MenuItem value="whatsapp">WhatsApp</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              margin="normal"
              label="Contenuto"
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              multiline
              rows={8}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annulla</Button>
          <Button onClick={handleSaveTemplate} variant="contained" color="primary">
            Salva
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog per eliminare template */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Conferma Eliminazione</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Sei sicuro di voler eliminare il template "{selectedTemplate?.name}"? Questa azione non può essere annullata.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Annulla</Button>
          <Button onClick={handleDeleteTemplate} color="error">
            Elimina
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notifica */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TemplateManager;