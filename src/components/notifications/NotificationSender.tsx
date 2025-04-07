import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Box,
  Typography,
  FormControlLabel,
  Switch,
  SelectChangeEvent
} from '@mui/material';
import axios from 'axios';
import { Template } from '../../types/template';
import { notificationService } from '../../services/notification.service';

interface NotificationSenderProps {
  open: boolean;
  onClose: () => void;
  onSend: () => void;
  patients: { id: number; first_name: string; last_name: string }[];
  templates: Template[];
  appointments: any[];
}

const NotificationSender: React.FC<NotificationSenderProps> = ({
  open,
  onClose,
  onSend,
  patients,
  templates,
  appointments
}) => {
  const [useTemplate, setUseTemplate] = useState<boolean>(true);
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('');
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [requiredVariables, setRequiredVariables] = useState<string[]>([]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setUseTemplate(true);
      setSelectedTemplate('');
      setSelectedPatient('');
      setCustomMessage('');
      setTemplateVariables({});
      setRequiredVariables([]);
    }
  }, [open]);

  // Handle template selection
  const handleTemplateChange = (event: SelectChangeEvent<number>) => {
    const templateId = event.target.value as number;
    setSelectedTemplate(templateId);
    
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        // Extract variables from template
        const variables = notificationService.extractTemplateVariables(template.content);
        setRequiredVariables(variables);
        
        // Initialize variables with empty values
        const initialVariables: Record<string, string> = {};
        variables.forEach(v => {
          initialVariables[v] = '';
        });
        setTemplateVariables(initialVariables);
      }
    } else {
      setRequiredVariables([]);
      setTemplateVariables({});
    }
  };

  // Handle variable change
  const handleVariableChange = (variable: string, value: string) => {
    setTemplateVariables(prev => ({
      ...prev,
      [variable]: value
    }));
  };

  // Handle appointment selection for auto-filling variables
  const handleAppointmentSelect = (appointmentId: string) => {
    const appointment = appointments.find(a => a.id.toString() === appointmentId);
    if (appointment) {
      // Format date for better readability
      const formattedDate = new Date(appointment.date).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      // Update all appointment related variables
      handleVariableChange('appointment_id', appointmentId);
      handleVariableChange('appointment_title', appointment.title || '');
      handleVariableChange('appointment_date', formattedDate);
      handleVariableChange('appointment_time', appointment.time || '');
    }
  };

  // Send notification
  const handleSendNotification = async () => {
    try {
      if (!selectedPatient) {
        alert('Seleziona un paziente');
        return;
      }

      const patient = patients.find(p => p.id.toString() === selectedPatient);
      if (!patient) return;

      // Get patient phone number
      const userResponse = await axios.get(`http://localhost:3001/api/users/${selectedPatient}`);
      const phoneNumber = userResponse.data.phone;
      
      if (!phoneNumber) {
        alert('Il paziente selezionato non ha un numero di telefono');
        return;
      }

      let message = '';
      let notificationId = null;
      
      if (useTemplate && selectedTemplate) {
        const template = templates.find(t => t.id === selectedTemplate);
        if (!template) return;
        
        // Replace variables in template
        const variables = {
          ...templateVariables,
          first_name: patient.first_name,
          last_name: patient.last_name,
          patient_name: `${patient.first_name} ${patient.last_name}`
        };
        
        message = notificationService.replaceTemplateVariables(template.content, variables);
        
        // Save notification to database
        const response = await axios.post('http://localhost:3001/api/notifications/template', {
          user_id: selectedPatient,
          template_id: selectedTemplate,
          variables: variables,
          appointment_id: templateVariables['appointment_id'] || null
        });
        
        if (response.data && response.data.id) {
          notificationId = response.data.id;
        }
      } else {
        message = customMessage;
        
        // Save notification to database
        const response = await axios.post('http://localhost:3001/api/notifications', {
          patient_id: selectedPatient,
          message: message
        });
        
        if (response.data && response.data.id) {
          notificationId = response.data.id;
        }
      }

      // Send WhatsApp notification
      await notificationService.sendWhatsAppNotification(phoneNumber, message);
      
      // Aggiorna lo stato della notifica nel database
      if (notificationId) {
        await axios.post(`http://localhost:3001/api/notifications/process/${notificationId}`);
      }
      
      onSend();
      onClose();
    } catch (error) {
      console.error('Error sending notification:', error);
      alert('Errore durante l\'invio della notifica');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Invia nuova notifica</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
          <InputLabel>Utente</InputLabel>
          <Select
            value={selectedPatient}
            label="Utente"
            onChange={(e) => setSelectedPatient(e.target.value as string)}
          >
            {patients.map((patient) => (
              <MenuItem key={patient.id} value={patient.id.toString()}>
                {patient.first_name} {patient.last_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <FormControlLabel
          control={
            <Switch
              checked={useTemplate}
              onChange={(e) => setUseTemplate(e.target.checked)}
              color="primary"
            />
          }
          label="Usa template"
          sx={{ mb: 2 }}
        />
        
        {useTemplate ? (
          <>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Template</InputLabel>
              <Select
                value={selectedTemplate}
                label="Template"
                onChange={handleTemplateChange}
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
              {selectedTemplate && (
                <FormHelperText>
                  {templates.find(t => t.id === selectedTemplate)?.description}
                </FormHelperText>
              )}
            </FormControl>
            
            {requiredVariables.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Variabili del template
                </Typography>
                
                {/* Selezione appuntamento per compilazione automatica */}
                {(templates.find(t => t.id === selectedTemplate)?.type === 'appointment_update' || 
                 templates.find(t => t.id === selectedTemplate)?.type === 'appointment_cancellation' ||
                 templates.find(t => t.id === selectedTemplate)?.type === 'appointment_confirmation') && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Seleziona Appuntamento</InputLabel>
                    <Select
                      value={templateVariables['appointment_id'] || ''}
                      label="Seleziona Appuntamento"
                      onChange={(e) => handleAppointmentSelect(e.target.value as string)}
                    >
                      <MenuItem value="">
                        <em>Seleziona un appuntamento</em>
                      </MenuItem>
                      {appointments.map((appointment) => (
                        <MenuItem key={appointment.id} value={appointment.id.toString()}>
                          {appointment.title || 'Appuntamento'} - {new Date(appointment.date).toLocaleDateString('it-IT')} {appointment.time}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Seleziona un appuntamento esistente per compilare automaticamente i campi
                    </FormHelperText>
                  </FormControl>
                )}
                
                {/* Campi per le variabili */}
                {requiredVariables.map((variable) => {
                  // Nascondi i campi che vengono compilati automaticamente quando si seleziona un appuntamento
                  if ((variable === 'appointment_title' || variable === 'appointment_date' || 
                       variable === 'appointment_time') && templateVariables['appointment_id']) {
                    return null;
                  }
                  
                  // Personalizza il campo in base al tipo di variabile
                  if (variable === 'appointment_title') {
                    return (
                      <TextField
                        key={variable}
                        label="Titolo appuntamento"
                        fullWidth
                        value={templateVariables[variable] || ''}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        margin="dense"
                        placeholder="Es. Visita di controllo"
                        helperText="Inserisci il titolo o il tipo di appuntamento"
                      />
                    );
                  } else if (variable === 'appointment_date') {
                    return (
                      <TextField
                        key={variable}
                        label="Data appuntamento"
                        fullWidth
                        value={templateVariables[variable] || ''}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        margin="dense"
                        placeholder="Es. 01/01/2023"
                        helperText="Inserisci la data dell'appuntamento (formato: GG/MM/AAAA)"
                      />
                    );
                  } else if (variable === 'appointment_time') {
                    return (
                      <TextField
                        key={variable}
                        label="Ora appuntamento"
                        fullWidth
                        value={templateVariables[variable] || ''}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        margin="dense"
                        placeholder="Es. 15:30"
                        helperText="Inserisci l'ora dell'appuntamento (formato: HH:MM)"
                      />
                    );
                  } else {
                    // Per tutte le altre variabili, usa un campo generico
                    return (
                      <TextField
                        key={variable}
                        label={variable.replace(/_/g, ' ')}
                        fullWidth
                        value={templateVariables[variable] || ''}
                        onChange={(e) => handleVariableChange(variable, e.target.value)}
                        margin="dense"
                      />
                    );
                  }
                })}
              </Box>
            )}
            
            {selectedTemplate && (
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Anteprima del messaggio
                </Typography>
                <Typography variant="body2">
                  {templates.find(t => t.id === selectedTemplate)?.content.replace(
                    /\{\{([^}]+)\}\}/g,
                    (match, variable) => {
                      if (variable === 'first_name' || variable === 'last_name' || variable === 'patient_name') {
                        const patient = patients.find(p => p.id.toString() === selectedPatient);
                        if (patient) {
                          if (variable === 'first_name') return patient.first_name;
                          if (variable === 'last_name') return patient.last_name;
                          if (variable === 'patient_name') return `${patient.first_name} ${patient.last_name}`;
                        }
                        return match;
                      }
                      if (variable === 'clinic_name') {
                        // Usa il nome dell'azienda dal servizio di notifica
                        return notificationService.getCompanyName();
                      }
                      return templateVariables[variable] || match;
                    }
                  )}
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <TextField
            label="Messaggio"
            multiline
            rows={4}
            fullWidth
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annulla</Button>
        <Button 
          onClick={handleSendNotification} 
          variant="contained"
          disabled={
            !selectedPatient || 
            (useTemplate ? !selectedTemplate : !customMessage)
          }
        >
          Invia
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NotificationSender;