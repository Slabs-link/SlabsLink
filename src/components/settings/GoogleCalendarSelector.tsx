import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  FormGroup,
  FormControlLabel
} from '@mui/material';
import axios from 'axios';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Calendar {
  id: string;
  summary: string;
}

interface GoogleCalendarSelectorProps {
  selectedCalendarId: string; // Mantenuto per retrocompatibilità
  onCalendarSelect: (calendarId: string) => void; // Mantenuto per retrocompatibilità
  selectedCalendarIds?: string[]; // Nuovo campo per supportare selezione multipla
  onCalendarsSelect?: (calendarIds: string[]) => void; // Nuovo callback per selezione multipla
  disabled?: boolean;
}

const GoogleCalendarSelector: React.FC<GoogleCalendarSelectorProps> = ({
  selectedCalendarId,
  onCalendarSelect,
  selectedCalendarIds = [],
  onCalendarsSelect,
  disabled = false
}) => {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarDescription, setNewCalendarDescription] = useState('');
  const [creatingCalendar, setCreatingCalendar] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState(false);
  
  // Stato locale per i calendari selezionati
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedCalendarIds.length > 0 ? selectedCalendarIds : [selectedCalendarId].filter(id => id));

  const API_BASE_URL = 'http://localhost:3001/api';

  // Carica la lista dei calendari disponibili
  const fetchCalendars = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/google-calendar/calendars`);
      if (response.data.success) {
        setCalendars(response.data.calendars);
      } else {
        setError(response.data.message || 'Errore durante il recupero dei calendari');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore durante il recupero dei calendari');
    } finally {
      setLoading(false);
    }
  };

  // Carica i calendari all'inizializzazione del componente
  useEffect(() => {
    if (!disabled) {
      fetchCalendars();
    }
  }, [disabled]);

  // Gestisce la selezione multipla dei calendari
  const handleCalendarToggle = async (calendarId: string) => {
    let newSelectedIds: string[];
    
    if (selectedIds.includes(calendarId)) {
      // Rimuovi il calendario se già selezionato
      newSelectedIds = selectedIds.filter(id => id !== calendarId);
    } else {
      // Aggiungi il calendario se non è selezionato
      newSelectedIds = [...selectedIds, calendarId];
    }
    
    // Assicurati che ci sia sempre almeno un calendario selezionato
    if (newSelectedIds.length === 0) {
      setError('Devi selezionare almeno un calendario');
      return;
    }
    
    setSelectedIds(newSelectedIds);
    
    // Chiama entrambi i callback per retrocompatibilità
    if (onCalendarSelect) {
      onCalendarSelect(newSelectedIds[0]); // Per retrocompatibilità
    }
    
    if (onCalendarsSelect) {
      onCalendarsSelect(newSelectedIds);
    }
    
    // Invia la selezione al server
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/google-calendar/select-calendars`, { calendarIds: newSelectedIds });
      if (response.data.success) {
        console.log('Calendari selezionati salvati con successo sul server');
      } else {
        setError(response.data.message || 'Errore durante il salvataggio della selezione dei calendari');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Errore durante il salvataggio della selezione dei calendari');
      console.error('Errore durante il salvataggio della selezione dei calendari:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apre il dialog per creare un nuovo calendario
  const handleOpenCreateDialog = () => {
    setOpenCreateDialog(true);
    setNewCalendarName('');
    setNewCalendarDescription('');
    setCreateError(null);
    setCreateSuccess(false);
  };

  // Chiude il dialog per creare un nuovo calendario
  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false);
  };

  // Crea un nuovo calendario
  const handleCreateCalendar = async () => {
    if (!newCalendarName.trim()) {
      setCreateError('Il nome del calendario è obbligatorio');
      return;
    }

    setCreatingCalendar(true);
    setCreateError(null);
    setCreateSuccess(false);

    try {
      const response = await axios.post(`${API_BASE_URL}/google-calendar/create-calendar`, {
        calendarName: newCalendarName.trim(),
        description: newCalendarDescription.trim()
      });

      if (response.data.success) {
        setCreateSuccess(true);
        // Aggiorna la lista dei calendari
        fetchCalendars();
        // Seleziona automaticamente il nuovo calendario
        if (response.data.calendarId) {
          // Aggiungi il nuovo calendario alla selezione
          const newSelectedIds = [...selectedIds, response.data.calendarId];
          setSelectedIds(newSelectedIds);
          
          // Chiama entrambi i callback per retrocompatibilità
          if (onCalendarSelect) {
            onCalendarSelect(response.data.calendarId);
          }
          
          if (onCalendarsSelect) {
            onCalendarsSelect(newSelectedIds);
          }
          
          // Salva la selezione sul server
          await axios.post(`${API_BASE_URL}/google-calendar/select-calendars`, { calendarIds: newSelectedIds });
        }
        // Chiudi il dialog dopo un breve ritardo
        setTimeout(() => {
          setOpenCreateDialog(false);
        }, 1500);
      } else {
        setCreateError(response.data.message || 'Errore durante la creazione del calendario');
      }
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Errore durante la creazione del calendario');
    } finally {
      setCreatingCalendar(false);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Paper sx={{ p: 3, bgcolor: '#f9f9f9' }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Seleziona Calendari
        </Typography>
        
        <Typography variant="body2" paragraph>
          Seleziona i calendari Google da utilizzare per la sincronizzazione degli appuntamenti.
          Puoi selezionare più calendari spuntando le caselle corrispondenti.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">
              Calendari disponibili:
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={handleOpenCreateDialog}
                disabled={disabled || loading}
                size="small"
              >
                Nuovo Calendario
              </Button>

              <Button
                variant="outlined"
                onClick={fetchCalendars}
                disabled={disabled || loading}
                size="small"
                startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
              >
                Aggiorna
              </Button>
            </Box>
          </Box>
          
          <FormControl component="fieldset" disabled={disabled || loading}>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedIds.includes('primary')}
                    onChange={() => handleCalendarToggle('primary')}
                  />
                }
                label="Calendario principale"
              />
              
              {calendars.map((calendar) => (
                <FormControlLabel
                  key={calendar.id}
                  control={
                    <Checkbox
                      checked={selectedIds.includes(calendar.id)}
                      onChange={() => handleCalendarToggle(calendar.id)}
                    />
                  }
                  label={calendar.summary}
                />
              ))}
            </FormGroup>
          </FormControl>
        </Box>
      </Paper>

      {/* Dialog per creare un nuovo calendario */}
      <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog}>
        <DialogTitle>Crea nuovo calendario</DialogTitle>
        <DialogContent>
          {createSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Calendario creato con successo!
            </Alert>
          )}

          {createError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createError}
            </Alert>
          )}

          <TextField
            autoFocus
            margin="dense"
            label="Nome calendario"
            fullWidth
            value={newCalendarName}
            onChange={(e) => setNewCalendarName(e.target.value)}
            disabled={creatingCalendar}
            required
          />
          <TextField
            margin="dense"
            label="Descrizione (opzionale)"
            fullWidth
            value={newCalendarDescription}
            onChange={(e) => setNewCalendarDescription(e.target.value)}
            disabled={creatingCalendar}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog} disabled={creatingCalendar}>
            Annulla
          </Button>
          <Button 
            onClick={handleCreateCalendar} 
            disabled={creatingCalendar || !newCalendarName.trim()}
            variant="contained"
          >
            {creatingCalendar ? <CircularProgress size={24} /> : 'Crea'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GoogleCalendarSelector;