import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  Event as EventIcon,
  Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Cancel as CancelIcon
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface Appointment {
  id: number;
  patient_id: number;
  patient_name: string;
  date: string;
  time: string;
  appointment_date: string;
  appointment_time: string;
  duration: number;
  notes?: string;
  status?: string;
  appointment_type_id?: number;
  appointment_type_name?: string;
  created_at: string;
  updated_at: string;
}

interface UserAppointmentsProps {
  userId: number;
}

const UserAppointments: React.FC<UserAppointmentsProps> = ({ userId }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const API_BASE_URL = 'http://localhost:3001/api';
  
  // Funzione per ottenere il colore del chip in base allo stato dell'appuntamento
  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'success';
      case 'upcoming':
        return 'primary';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };
  
  // Funzione per ottenere l'icona in base allo stato dell'appuntamento
  const getStatusIcon = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return <CheckCircleIcon fontSize="small" />;
      case 'upcoming':
        return <ScheduleIcon fontSize="small" />;
      case 'cancelled':
        return <CancelIcon fontSize="small" />;
      default:
        return <EventIcon fontSize="small" />;
    }
  };
  
  // Funzione per formattare lo stato dell'appuntamento
  const formatStatus = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return 'Completato';
      case 'upcoming':
        return 'In programma';
      case 'cancelled':
        return 'Annullato';
      default:
        return 'Non specificato';
    }
  };
  
  // Carica gli appuntamenti dell'utente
  const fetchUserAppointments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Recupero appuntamenti per userId:', userId);
      
      // Usa direttamente l'endpoint specifico per gli appuntamenti del paziente
      const response = await axios.get(`${API_BASE_URL}/appointments/patient/${userId}`);
      
      if (response.data && response.data.appointments) {
        console.log('Appuntamenti ricevuti:', response.data.appointments);
        setAppointments(response.data.appointments);
      } else if (Array.isArray(response.data)) {
        console.log('Appuntamenti ricevuti (array):', response.data);
        setAppointments(response.data);
      } else {
        console.log('Nessun appuntamento trovato o formato risposta non riconosciuto');
        // Se non ci sono appuntamenti, mostra un array vuoto
        setAppointments([]);
      }
    } catch (err: any) {
      console.error('Errore durante il recupero degli appuntamenti:', err);
      setError('Impossibile caricare gli appuntamenti dell\'utente');
      
      // In caso di errore, mostra un array vuoto invece di dati di esempio
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Carica gli appuntamenti all'inizializzazione del componente
  useEffect(() => {
    if (userId) {
      fetchUserAppointments();
    }
  }, [userId]);
  
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Storico Appuntamenti
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress size={30} />
        </Box>
      ) : appointments.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Nessun appuntamento trovato per questo utente
          </Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '400px', overflow: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Data</TableCell>
                <TableCell>Ora</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Stato</TableCell>
                <TableCell>Note</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appointments.map((appointment) => {
                // Usa appointment_date e appointment_time se disponibili, altrimenti usa date e time
                const dateStr = appointment.appointment_date || appointment.date;
                const timeStr = appointment.appointment_time || appointment.time;
                
                // Formatta la data
                let formattedDate = '';
                try {
                  if (dateStr) {
                    formattedDate = format(new Date(dateStr), 'dd/MM/yyyy', { locale: it });
                  }
                } catch (e) {
                  console.error('Errore nella formattazione della data:', e);
                  formattedDate = dateStr || '';
                }
                
                return (
                  <TableRow key={appointment.id}>
                    <TableCell>{formattedDate}</TableCell>
                    <TableCell>{timeStr}</TableCell>
                    <TableCell>
                      {appointment.appointment_type_name || 'Non specificato'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getStatusIcon(appointment.status)}
                        label={formatStatus(appointment.status)}
                        size="small"
                        color={getStatusColor(appointment.status) as any}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {appointment.notes ? (
                        <Tooltip title={appointment.notes}>
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default UserAppointments;