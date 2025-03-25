import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, AlertColor, SelectChangeEvent
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Template } from '../../types/template';

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
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Gestione Template</Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
        >
          Nuovo Template
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Descrizione</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Sistema</TableCell>
              <TableCell>Azioni</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>{template.name}</TableCell>
                <TableCell>{template.description}</TableCell>
                <TableCell>{template.type}</TableCell>
                <TableCell>{template.is_system ? 'Sì' : 'No'}</TableCell>
                <TableCell>
                  {!template.is_system && (
                    <>
                      <IconButton onClick={() => handleOpenDialog(template)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleOpenDeleteDialog(template)}>
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog per creare/modificare un template */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTemplate ? 'Modifica Template' : 'Nuovo Template'}
        </DialogTitle>
        <DialogContent>
          <TextField
            name="name"
            label="Nome"
            fullWidth
            value={formData.name}
            onChange={handleInputChange}
            margin="normal"
            required
          />
          <TextField
            name="description"
            label="Descrizione"
            fullWidth
            value={formData.description}
            onChange={handleInputChange}
            margin="normal"
            multiline
            rows={2}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo</InputLabel>
            <Select
              name="type"
              value={formData.type}
              label="Tipo"
              onChange={handleSelectChange}
            >
              <MenuItem value="custom">Personalizzato</MenuItem>
              <MenuItem value="appointment_confirmation">Conferma Appuntamento</MenuItem>
              <MenuItem value="appointment_cancellation">Cancellazione Appuntamento</MenuItem>
              <MenuItem value="appointment_update">Modifica Appuntamento</MenuItem>
              <MenuItem value="christmas_wishes">Auguri Natalizi</MenuItem>
              <MenuItem value="new_year_wishes">Auguri Nuovo Anno</MenuItem>
            </Select>
          </FormControl>
          <TextField
            name="content"
            label="Contenuto"
            fullWidth
            value={formData.content}
            onChange={handleInputChange}
            margin="normal"
            multiline
            rows={6}
            required
            helperText="Usa {{patient_name}} per il nome del paziente e altre variabili come {{appointment_date}}, {{appointment_time}}, ecc."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annulla</Button>
          <Button 
            onClick={handleSaveTemplate} 
            variant="contained"
            disabled={!formData.name || !formData.content}
          >
            Salva
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog per confermare l'eliminazione */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Conferma eliminazione</DialogTitle>
        <DialogContent>
          <Typography>
            Sei sicuro di voler eliminare il template "{selectedTemplate?.name}"?
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TemplateManager;