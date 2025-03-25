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
  DialogContent
} from '@mui/material';
import { 
  Add as AddIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon,
  Event as EventIcon,
  Person as PersonIcon,
  AccessTime as TimeIcon,
  Notes as NotesIcon
} from '@mui/icons-material';
import axios from 'axios';
import AppointmentForm from './AppointmentForm';
import { styled } from '@mui/material/styles';
import Sidebar from '../common/Sidebar';

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

// Interfaccia per le notifiche
interface NotificationState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:3001/api/appointments');
      setAppointments(response.data);
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

  const handleOpenFormDialog = (appointment: Appointment | null = null) => {
    setSelectedAppointment(appointment);
    setOpenFormDialog(true);
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
    <Box sx={{ display: 'flex' }}> {/* Contenitore principale con display flex */}
      <Sidebar /> {/* La sidebar qui */}
      
      <Box sx={{ flexGrow: 1, p: 3, ml: '0px' }}> {/* Rimosso il margine a sinistra */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3 
        }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Appuntamenti
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => handleOpenFormDialog()}
            sx={{ 
              borderRadius: 2,
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
            }}
          >
            Nuovo Appuntamento
          </Button>
        </Box>

        {/* Resto del contenuto... */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : appointments.length === 0 ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            mt: 8,
            p: 3,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1
          }}>
            <EventIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Nessun appuntamento trovato
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Non ci sono appuntamenti programmati. Clicca sul pulsante "Nuovo Appuntamento" per crearne uno.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={() => handleOpenFormDialog()}
            >
              Nuovo Appuntamento
            </Button>
          </Box>
        ) : (
          <Grid container spacing={3}>
            {appointments.map((appointment) => (
              <Grid item xs={12} sm={6} md={4} key={appointment.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
                        {appointment.title}
                      </Typography>
                      <Chip 
                        label={translateStatus(appointment.status)} 
                        color={getStatusColor(appointment.status) as any}
                        size="small"
                      />
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body1">
                        {appointment.first_name && appointment.last_name 
                          ? `${appointment.first_name} ${appointment.last_name}`
                          : appointment.patient_name || 'Utente non specificato'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <EventIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {formatDate(appointment.appointment_date || appointment.date || '')}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <TimeIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="body2">
                        {appointment.appointment_time || appointment.time || ''} - {appointment.duration} min
                      </Typography>
                    </Box>
                    
                    {appointment.notes && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 2 }}>
                        <NotesIcon sx={{ mr: 1, mt: 0.5, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {appointment.notes}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                  
                  <Divider />
                  
                  <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleOpenFormDialog(appointment)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      size="small"
                      color="error"
                      onClick={() => handleOpenDeleteDialog(appointment)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Dialog per creare/modificare appuntamenti */}
        <Dialog 
          open={openFormDialog} 
          onClose={handleCloseFormDialog} 
          maxWidth="sm" 
          fullWidth
        >
          <DialogTitle>
            {selectedAppointment ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}
          </DialogTitle>
          <AppointmentForm 
            appointment={selectedAppointment} 
            onSave={handleSaveAppointment} 
            onCancel={handleCloseFormDialog} 
          />
        </Dialog>

        {/* Dialog per confermare l'eliminazione */}
        <Dialog
          open={openDeleteDialog}
          onClose={handleCloseDeleteDialog}
        >
          <DialogTitle>Conferma eliminazione</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Sei sicuro di voler eliminare questo appuntamento? Questa azione non può essere annullata.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Annulla</Button>
            <Button onClick={handleDeleteAppointment} color="error" variant="contained">
              Elimina
            </Button>
          </DialogActions>
        </Dialog>

        {/* Notifiche */}
        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={handleCloseNotification}
            severity={notification.severity}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default Appointments;