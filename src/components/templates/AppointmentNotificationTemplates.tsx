import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Divider,
  Chip,
  Grid,
  Card,
  CardContent,
  IconButton,
  Snackbar,
  Alert,
  AlertColor,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  FormHelperText,
  Tooltip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Edit as EditIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import axios from 'axios';
import { Template } from '../../types/template';
import Sidebar from '../common/Sidebar';

// Componenti styled
const SectionTitle = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  marginBottom: theme.spacing(2)
}));

const ContentCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column'
}));

const FieldChip = styled(Chip)(({ theme }) => ({
  margin: theme.spacing(0.5),
  cursor: 'grab'
}));

const TemplatePreview = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginTop: theme.spacing(2),
  backgroundColor: '#f5f5f5',
  borderRadius: theme.shape.borderRadius,
  minHeight: '100px'
}));

// Interfaccia per i campi disponibili
interface FieldOption {
  id: string;
  label: string;
  variable: string;
  description: string;
}

// Componente principale
const AppointmentNotificationTemplates: React.FC = () => {
  // Stati per i template
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateContent, setTemplateContent] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('appointment_confirmation');
  const [templateDescription, setTemplateDescription] = useState('');
  const textFieldRef = useRef<HTMLTextAreaElement>(null);
  
  // Stato per la notifica
  const [notification, setNotification] = useState<{
    open: boolean;
    message: string;
    severity: AlertColor;
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // Campi disponibili per il drag and drop
  const [availableFields] = useState<FieldOption[]>([
    { id: 'user_name', label: 'Nome Utente', variable: '{{first_name}}', description: 'Nome dell\'utente' },
    { id: 'user_surname', label: 'Cognome Utente', variable: '{{last_name}}', description: 'Cognome dell\'utente' },
    { id: 'appointment_title', label: 'Titolo Appuntamento', variable: '{{appointment_title}}', description: 'Titolo dell\'appuntamento' },
    { id: 'appointment_date', label: 'Data Appuntamento', variable: '{{appointment_date}}', description: 'Data dell\'appuntamento' },
    { id: 'appointment_time', label: 'Ora Appuntamento', variable: '{{appointment_time}}', description: 'Ora dell\'appuntamento' },
    { id: 'patient_name', label: 'Nome Paziente', variable: '{{patient_name}}', description: 'Nome completo del paziente' },
    { id: 'clinic_name', label: 'Nome Studio/Azienda', variable: '{{clinic_name}}', description: 'Nome dello studio o dell\'azienda' }
  ]);

  // Carica i template all'avvio
  useEffect(() => {
    fetchTemplates();
  }, []);

  // Funzione per caricare i template
  const fetchTemplates = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/templates');
      setTemplates(response.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setNotification({
        open: true,
        message: 'Errore durante il caricamento dei template',
        severity: 'error'
      });
    }
  };

  // Gestione del cambio template
  const handleTemplateChange = (event: SelectChangeEvent<number>) => {
    const templateId = event.target.value as number;
    const template = templates.find(t => t.id === templateId);
    
    if (template) {
      setSelectedTemplate(template);
      setTemplateContent(template.content);
      setTemplateName(template.name);
      setTemplateType(template.type);
      setTemplateDescription(template.description || '');
    } else {
      resetForm();
    }
  };

  // Funzione per resettare il form
  const resetForm = () => {
    setSelectedTemplate(null);
    setTemplateContent('');
    setTemplateName('');
    setTemplateType('appointment_confirmation');
    setTemplateDescription('');
  };

  // Funzione per inserire un campo nel template
  const insertField = (field: FieldOption) => {
    const textField = textFieldRef.current;
    if (!textField) return;
    
    const cursorPosition = textField.selectionStart || 0;
    
    const newContent = 
      templateContent.substring(0, cursorPosition) + 
      field.variable + 
      templateContent.substring(cursorPosition);
    
    setTemplateContent(newContent);
    
    // Riposiziona il cursore dopo la variabile inserita
    setTimeout(() => {
      textField.focus();
      const newPosition = cursorPosition + field.variable.length;
      textField.selectionStart = newPosition;
      textField.selectionEnd = newPosition;
    }, 0);
  };

  // Funzione per salvare il template
  const handleSaveTemplate = async () => {
    try {
      if (!templateName || !templateContent) {
        setNotification({
          open: true,
          message: 'Nome e contenuto del template sono obbligatori',
          severity: 'error'
        });
        return;
      }

      setNotification({
        open: true,
        message: 'Salvataggio in corso...',
        severity: 'info'
      });

      const templateData = {
        name: templateName,
        type: templateType,
        content: templateContent,
        description: templateDescription
      };

      if (selectedTemplate) {
        // Aggiorna template esistente
        await axios.put(`http://localhost:3001/api/templates/${selectedTemplate.id}`, templateData);
        setNotification({
          open: true,
          message: 'Template aggiornato con successo',
          severity: 'success'
        });
      } else {
        // Crea nuovo template
        await axios.post('http://localhost:3001/api/templates', templateData);
        setNotification({
          open: true,
          message: 'Template creato con successo',
          severity: 'success'
        });
      }
      
      fetchTemplates();
      resetForm();
    } catch (error: any) {
      console.error('Error saving template:', error);
      setNotification({
        open: true,
        message: `Errore durante il salvataggio del template: ${error.response?.data?.message || error.message}`,
        severity: 'error'
      });
    }
  };

  // Funzione per creare un nuovo template
  const handleCreateNewTemplate = () => {
    resetForm();
  };

  // Chiudi la notifica
  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // Funzione per creare template predefiniti
  const createPredefinedTemplate = (type: string) => {
    let name = '';
    let content = '';
    let description = '';
    
    switch (type) {
      case 'new_appointment':
        name = 'Nuovo Appuntamento';
        description = 'Template per notificare un nuovo appuntamento';
        content = 'Gentile {{patient_name}}, le confermiamo che è stato fissato un nuovo appuntamento per {{appointment_title}} in data {{appointment_date}} alle ore {{appointment_time}}. La aspettiamo!';
        break;
      case 'modified_appointment':
        name = 'Modifica Appuntamento';
        description = 'Template per notificare la modifica di un appuntamento';
        content = 'Gentile {{patient_name}}, le comunichiamo che l\'appuntamento per {{appointment_title}} è stato modificato. Il nuovo appuntamento è fissato per il {{appointment_date}} alle ore {{appointment_time}}. La aspettiamo!';
        break;
      case 'cancelled_appointment':
        name = 'Cancellazione Appuntamento';
        description = 'Template per notificare la cancellazione di un appuntamento';
        content = 'Gentile {{patient_name}}, le comunichiamo che l\'appuntamento per {{appointment_title}} previsto per il {{appointment_date}} alle ore {{appointment_time}} è stato cancellato. Per maggiori informazioni o per fissare un nuovo appuntamento, la preghiamo di contattarci.';
        break;
      default:
        return;
    }
    
    setSelectedTemplate(null);
    setTemplateName(name);
    setTemplateType(type === 'new_appointment' ? 'appointment_confirmation' : 
                    type === 'modified_appointment' ? 'appointment_update' : 
                    'appointment_cancellation');
    setTemplateContent(content);
    setTemplateDescription(description);
  };

  // Funzione per renderizzare l'anteprima con le variabili evidenziate
  const renderPreview = () => {
    if (!templateContent) return null;
    
    // Dividi il contenuto in parti, separando le variabili dal testo normale
    const parts = [];
    let lastIndex = 0;
    const regex = /{{([^}]+)}}/g;
    let match;
    
    while ((match = regex.exec(templateContent)) !== null) {
      // Aggiungi il testo prima della variabile
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: templateContent.substring(lastIndex, match.index)
        });
      }
      
      // Aggiungi la variabile
      parts.push({
        type: 'variable',
        content: match[1]
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // Aggiungi il testo rimanente dopo l'ultima variabile
    if (lastIndex < templateContent.length) {
      parts.push({
        type: 'text',
        content: templateContent.substring(lastIndex)
      });
    }
    
    return (
      <Box sx={{ lineHeight: 1.6 }}>
        {parts.map((part, index) => (
          part.type === 'text' ? (
            <span key={index}>{part.content}</span>
          ) : (
            <Chip 
              key={index} 
              label={part.content} 
              size="small" 
              color="primary" 
              variant="outlined"
              sx={{ mx: 0.5, my: 0.25 }}
            />
          )
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <SectionTitle variant="h4">Template di Notifica Appuntamenti</SectionTitle>
        
        <Grid container spacing={3}>
          {/* Colonna sinistra - Template predefiniti e selezione */}
          <Grid item xs={12} md={4}>
            <ContentCard>
              <Typography variant="h6" gutterBottom>Template Predefiniti</Typography>
              <Box sx={{ mb: 3 }}>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  sx={{ mb: 1 }}
                  onClick={() => createPredefinedTemplate('new_appointment')}
                >
                  Nuovo Appuntamento
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  sx={{ mb: 1 }}
                  onClick={() => createPredefinedTemplate('modified_appointment')}
                >
                  Modifica Appuntamento
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth
                  onClick={() => createPredefinedTemplate('cancelled_appointment')}
                >
                  Cancellazione Appuntamento
                </Button>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="h6" gutterBottom>Template Esistenti</Typography>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Seleziona Template</InputLabel>
                <Select
                  value={selectedTemplate?.id || ''}
                  label="Seleziona Template"
                  onChange={handleTemplateChange as any}
                >
                  <MenuItem value="">
                    <em>Seleziona un template</em>
                  </MenuItem>
                  {templates.map((template) => (
                    <MenuItem key={template.id} value={template.id}>
                      {template.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                fullWidth
                onClick={handleCreateNewTemplate}
              >
                Nuovo Template
              </Button>
            </ContentCard>
          </Grid>
          
          {/* Colonna centrale - Editor template */}
          <Grid item xs={12} md={8}>
            <ContentCard>
              <Typography variant="h6" gutterBottom>Editor Template</Typography>
              
              <TextField
                label="Nome Template"
                fullWidth
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                margin="normal"
                required
              />
              
              <TextField
                label="Descrizione"
                fullWidth
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                margin="normal"
                multiline
                rows={2}
              />
              
              <FormControl fullWidth margin="normal">
                <InputLabel>Tipo Template</InputLabel>
                <Select
                  value={templateType}
                  label="Tipo Template"
                  onChange={(e) => setTemplateType(e.target.value)}
                >
                  <MenuItem value="appointment_confirmation">Conferma Appuntamento</MenuItem>
                  <MenuItem value="appointment_update">Modifica Appuntamento</MenuItem>
                  <MenuItem value="appointment_cancellation">Cancellazione Appuntamento</MenuItem>
                  <MenuItem value="custom">Personalizzato</MenuItem>
                </Select>
              </FormControl>
              
              <Box sx={{ my: 2 }}>
                <Typography variant="subtitle1" gutterBottom>Campi Disponibili</Typography>
                <Paper sx={{ p: 1, display: 'flex', flexWrap: 'wrap' }}>
                  {availableFields.map((field) => (
                    <Tooltip key={field.id} title={field.description}>
                      <FieldChip
                        label={field.label}
                        onClick={() => insertField(field)}
                        icon={<DragIndicatorIcon />}
                      />
                    </Tooltip>
                  ))}
                </Paper>
                <FormHelperText>Clicca su un campo per inserirlo nel template</FormHelperText>
              </Box>
              
              <TextField
                id="template-content"
                inputRef={textFieldRef}
                label="Contenuto Template"
                fullWidth
                value={templateContent}
                onChange={(e) => setTemplateContent(e.target.value)}
                margin="normal"
                multiline
                rows={8}
                required
                placeholder="Scrivi qui il contenuto del template o inserisci i campi disponibili"
              />
              
              <TemplatePreview>
                <Typography variant="subtitle2" gutterBottom>Anteprima</Typography>
                {renderPreview()}
              </TemplatePreview>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  startIcon={<SaveIcon />}
                  onClick={handleSaveTemplate}
                  disabled={!templateName || !templateContent}
                >
                  {selectedTemplate ? 'Aggiorna Template' : 'Salva Template'}
                </Button>
              </Box>
            </ContentCard>
          </Grid>
        </Grid>
        
        {/* Snackbar per le notifiche */}
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
    </Box>
  );
};

export default AppointmentNotificationTemplates;