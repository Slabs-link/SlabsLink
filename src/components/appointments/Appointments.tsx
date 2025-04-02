import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Dialog, 
  DialogTitle,
  IconButton,
  Grid,
  Card,
  CardContent,
  CardActions,
  Divider,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  AlertColor,
  DialogContentText,
  DialogActions,
  DialogContent,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  Paper,
  FormControl,
  InputLabel,
  Container
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Event as EventIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Notes as NotesIcon,
  Search as SearchIcon,
  FilterAlt as FilterIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { it } from 'date-fns/locale';
import { addMinutes } from 'date-fns';
import axios from 'axios';
import AppointmentForm from './AppointmentForm';
import { styled } from '@mui/material/styles';
import Sidebar from '../common/Sidebar';
import { TableRow, TableCell } from '@mui/material';
import { formatDate, translateStatus } from '../../utils';

const SidebarItem = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    borderRadius: theme.shape.borderRadius,
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: '#e8f0fe',
    },
    '&.active': {
      backgroundColor: '#e8f0fe',
      color: theme.palette.primary.main,
    }
  }));

// Aggiungo nuovi componenti styled per migliorare il layout
const SectionTitle = styled(Typography)(({ theme }) => ({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontWeight: 'bold',
  marginBottom: theme.spacing(2)
}));

const AppointmentsList = styled(Box)(({ theme }) => ({
  overflowY: 'auto',
  maxHeight: '70vh'
}));

const FilterContainer = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  marginBottom: theme.spacing(3),
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  alignItems: 'center'
}));

// Interfaccia per gli appuntamenti
interface Appointment {
  id: number;
  title: string;
  patient_id: number;
  patient_name: string;
  appointment_date: string; // Campo corretto restituito dall'API
  appointment_time: string; // Campo corretto restituito dall'API
  date?: string; // Mantenuto per retrocompatibilità
  time?: string; // Mantenuto per retrocompatibilità
  duration: number;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  first_name?: string; // Aggiunto per supportare i dati dell'utente
  last_name?: string; // Aggiunto per supportare i dati dell'utente
}

// Interfaccia per i filtri
interface FilterOptions {
  patientName: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
}

// Interfaccia per le notifiche
interface NotificationState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });
  
  // Stato per i filtri
  const [filters, setFilters] = useState<FilterOptions>({
    patientName: '',
    startDate: null,
    endDate: null,
    status: 'all'
  });

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3001/api/appointments');
      setAppointments(response.data);
      setFilteredAppointments(response.data); // Inizialmente mostra tutti gli appuntamenti
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setNotification({
        open: true,
        message: 'Errore nel caricamento degli appuntamenti',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);
  
  // Funzione per applicare i filtri
  const applyFilters = () => {
    let result = [...appointments];
    
    // Filtra per nome paziente
    if (filters.patientName.trim() !== '') {
      const searchTerm = filters.patientName.toLowerCase().trim();
      result = result.filter(appointment => {
        const fullName = `${appointment.first_name || ''} ${appointment.last_name || ''} ${appointment.patient_name || ''}`.toLowerCase();
        return fullName.includes(searchTerm);
      });
    }
    
    // Filtra per data di inizio
    if (filters.startDate) {
      result = result.filter(appointment => {
        const appointmentDate = new Date(appointment.appointment_date || appointment.date || '');
        return appointmentDate >= filters.startDate!;
      });
    }
    
    // Filtra per data di fine
    if (filters.endDate) {
      result = result.filter(appointment => {
        const appointmentDate = new Date(appointment.appointment_date || appointment.date || '');
        return appointmentDate <= filters.endDate!;
      });
    }
    
    // Filtra per stato
    if (filters.status !== 'all') {
      result = result.filter(appointment => appointment.status === filters.status);
    }
    
    setFilteredAppointments(result);
  };
  
  // Applica i filtri quando cambiano
  useEffect(() => {
    applyFilters();
  }, [filters, appointments]);
  
  // Gestione del cambio dei filtri
  const handleFilterChange = (field: keyof FilterOptions, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Funzione per resettare i filtri
  const resetFilters = () => {
    setFilters({
      patientName: '',
      startDate: null,
      endDate: null,
      status: 'all'
    });
  };

  const handleOpenFormDialog = (appointment: Appointment | null = null) => {
    // Se stiamo modificando un appuntamento esistente, ottieni i dettagli completi
    if (appointment) {
      axios.get(`http://localhost:3001/api/appointments/${appointment.id}`)
        .then(response => {
          setSelectedAppointment(response.data);
          setOpenFormDialog(true);
        })
        .catch(error => {
          console.error('Error fetching appointment details:', error);
          setNotification({
            open: true,
            message: 'Errore nel caricamento dei dettagli dell\'appuntamento',
            severity: 'error'
          });
          // In caso di errore, usa comunque i dati disponibili
          setSelectedAppointment(appointment);
          setOpenFormDialog(true);
        });
    } else {
      setSelectedAppointment(null);
      setOpenFormDialog(true);
    }
  };

  const handleCloseFormDialog = () => {
    setOpenFormDialog(false);
    setSelectedAppointment(null);
  };

  const handleOpenDeleteDialog = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSelectedAppointment(null);
  };

  const handleSaveAppointment = async (appointmentData: any) => {
    try {
      setNotification({
        open: true,
        message: 'Salvataggio in corso...',
        severity: 'info'
      });

      if (appointmentData.id) {
        // Update existing appointment
        await axios.put(`http://localhost:3001/api/appointments/${appointmentData.id}`, appointmentData);
        setNotification({
          open: true,
          message: 'Appuntamento aggiornato con successo',
          severity: 'success'
        });
      } else {
        // Create new appointment
        await axios.post('http://localhost:3001/api/appointments', appointmentData);
        setNotification({
          open: true,
          message: 'Appuntamento creato con successo',
          severity: 'success'
        });
      }
      
      handleCloseFormDialog();
      fetchAppointments();
    } catch (error) {
      console.error('Error saving appointment:', error);
      setNotification({
        open: true,
        message: 'Errore durante il salvataggio dell\'appuntamento',
        severity: 'error'
      });
    }
  };

  const handleDeleteAppointment = async () => {
    if (!selectedAppointment) return;
    
    try {
      setNotification({
        open: true,
        message: 'Eliminazione in corso...',
        severity: 'info'
      });
      
      await axios.delete(`http://localhost:3001/api/appointments/${selectedAppointment.id}`);
      
      setNotification({
        open: true,
        message: 'Appuntamento eliminato con successo',
        severity: 'success'
      });
      
      handleCloseDeleteDialog();
      fetchAppointments();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      setNotification({
        open: true,
        message: 'Errore durante l\'eliminazione dell\'appuntamento',
        severity: 'error'
      });
    }
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // Funzione per formattare la data
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Data non disponibile';
    
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    try {
      return new Date(dateString).toLocaleDateString('it-IT', options);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Data non valida';
    }
  };

  // Funzione per ottenere il colore dello stato
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'primary';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  // Funzione per tradurre lo stato
  const translateStatus = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Programmato';
      case 'completed':
        return 'Completato';
      case 'cancelled':
        return 'Annullato';
      default:
        return status;
    }
  };

  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <SectionTitle variant="h4">Gestione Appuntamenti</SectionTitle>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setSelectedAppointment(null);
                setOpenFormDialog(true);
              }}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Nuovo Appuntamento
            </Button>
          </Box>
          
          {/* Filtri */}
          <FilterContainer>
            <TextField
              label="Nome Paziente"
              variant="outlined"
              size="small"
              value={filters.patientName}
              onChange={(e) => handleFilterChange('patientName', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, minWidth: '200px' }}
            />
            
            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={it}>
              <DatePicker
                label="Data Inizio"
                value={filters.startDate}
                onChange={(date) => handleFilterChange('startDate', date)}
                slotProps={{ textField: { size: 'small' } }}
                sx={{ minWidth: '160px' }}
              />
              
              <DatePicker
                label="Data Fine"
                value={filters.endDate}
                onChange={(date) => handleFilterChange('endDate', date)}
                slotProps={{ textField: { size: 'small' } }}
                sx={{ minWidth: '160px' }}
              />
            </LocalizationProvider>
            
            <FormControl size="small" sx={{ minWidth: '150px' }}>
              <InputLabel id="status-filter-label">Stato</InputLabel>
              <Select
                labelId="status-filter-label"
                value={filters.status}
                label="Stato"
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="all">Tutti</MenuItem>
                <MenuItem value="scheduled">Programmati</MenuItem>
                <MenuItem value="completed">Completati</MenuItem>
                <MenuItem value="cancelled">Cancellati</MenuItem>
              </Select>
            </FormControl>
            
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={resetFilters}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Reset Filtri
            </Button>
          </FilterContainer>
          
          {/* Lista Appuntamenti */}
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <AppointmentsList>
              {filteredAppointments.length > 0 ? (
                <Grid container spacing={2}>
                  {filteredAppointments.map((appointment) => (
                    <Grid item xs={12} sm={6} md={4} key={appointment.id}>
                      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {appointment.title || 'Appuntamento'}
                            </Typography>
                            <Chip
                              label={translateStatus(appointment.status)}
                              color={appointment.status === 'completed' ? 'success' : appointment.status === 'cancelled' ? 'error' : 'primary'}
                              size="small"
                              sx={{ whiteSpace: 'nowrap' }}
                            />
                          </Box>
                          
                          <Divider sx={{ mb: 2 }} />
                          
                          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                            <PersonIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="body2" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {appointment.first_name && appointment.last_name
                                ? `${appointment.first_name} ${appointment.last_name}`
                                : appointment.patient_name || 'Paziente'}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                            <EventIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="body2">
                              {formatDate(appointment.appointment_date || appointment.date || '')}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                            <TimeIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="body2">
                              {(() => {
                                const startTime = appointment.appointment_time || appointment.time;
                                if (!startTime) return 'Orario non specificato';
                                
                                // Calcola l'ora di fine aggiungendo la durata all'ora di inizio
                                try {
                                  const [hours, minutes] = startTime.split(':').map(Number);
                                  const startDate = new Date();
                                  startDate.setHours(hours, minutes, 0);
                                  
                                  const endDate = addMinutes(startDate, appointment.duration);
                                  const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`;
                                  
                                  return `${startTime} - ${endTime}`;
                                } catch (error) {
                                  console.error('Error calculating end time:', error);
                                  return startTime;
                                }
                              })()}
                            </Typography>
                          </Box>
                          
                          {appointment.notes && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start' }}>
                                <NotesIcon fontSize="small" sx={{ mr: 1, mt: 0.5, color: 'text.secondary' }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                                  {appointment.notes}
                                </span>
                              </Typography>
                            </Box>
                          )}
                        </CardContent>
                        
                        <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setOpenFormDialog(true);
                            }}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            Modifica
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => {
                              setSelectedAppointment(appointment);
                              setOpenDeleteDialog(true);
                            }}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            Elimina
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ textAlign: 'center', p: 4 }}>
                  <Typography variant="h6" color="text.secondary">
                    Nessun appuntamento trovato
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Prova a modificare i filtri o crea un nuovo appuntamento
                  </Typography>
                </Box>
              )}
            </AppointmentsList>
          )}
        </Container>
      </Box>
      
      {/* Dialog per il form di creazione/modifica */}
      <Dialog open={openFormDialog} onClose={() => setOpenFormDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {selectedAppointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <AppointmentForm
            appointment={selectedAppointment}
            onSave={handleSaveAppointment}
            onCancel={() => setOpenFormDialog(false)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Dialog per la conferma di eliminazione */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Conferma Eliminazione</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare questo appuntamento? Questa azione non può essere annullata.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Annulla</Button>
          <Button onClick={handleDeleteAppointment} color="error" autoFocus>
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Notifica */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification({ ...notification, open: false })}
      >
        <Alert onClose={() => setNotification({ ...notification, open: false })} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Appointments;
