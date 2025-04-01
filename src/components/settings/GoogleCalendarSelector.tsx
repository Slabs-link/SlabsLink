import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  SelectChangeEvent
} from '@mui/material';
import axios from 'axios';

interface Calendar {
  id: string;
  summary: string;
}

interface GoogleCalendarSelectorProps {
  selectedCalendarId: string;
  onCalendarSelect: (calendarId: string) => void;
  disabled?: boolean;
}

const GoogleCalendarSelector: React.FC<GoogleCalendarSelectorProps> = ({
  selectedCalendarId,
  onCalendarSelect,
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

  // Gestisce la selezione di un calendario
  const handleCalendarChange = (event: SelectChangeEvent<string>, child: React.ReactNode) => {
    const calendarId = event.target.value;
    onCalendarSelect(calendarId);
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
          onCalendarSelect(response.data.calendarId);
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
          Seleziona Calendario
        </Typography>
        
        <Typography variant="body2" paragraph>
          Seleziona il calendario Google da utilizzare per la sincronizzazione degli appuntamenti.
          Puoi anche creare un nuovo calendario dedicato per SlabsLink.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl fullWidth disabled={disabled || loading}>
            <InputLabel id="calendar-select-label">Calendario</InputLabel>
            <Select
              labelId="calendar-select-label"
              value={selectedCalendarId || ''}
              onChange={handleCalendarChange}
              label="Calendario"
            >
              <MenuItem value="primary">Calendario principale</MenuItem>
              {calendars.map((calendar) => (
                <MenuItem key={calendar.id} value={calendar.id}>
                  {calendar.summary}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            onClick={handleOpenCreateDialog}
            disabled={disabled || loading}
          >
            Nuovo Calendario
          </Button>

          <Button
            variant="outlined"
            onClick={fetchCalendars}
            disabled={disabled || loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Aggiorna'}
          </Button>
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