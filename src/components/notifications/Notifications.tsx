import React, { useState, useEffect, useCallback } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Snackbar,
  Alert,
  AlertColor,
  DialogContentText,
  DialogActions,
  DialogContent,
  TextField,
  MenuItem,
  Select,
  SelectChangeEvent,
  FormControl,
  InputLabel,
  Pagination,
  Tooltip,
  FormControlLabel,
  Switch,
  FormHelperText
} from '@mui/material';
import { 
  Add as AddIcon, 
  Refresh as RefreshIcon, 
  Delete as DeleteIcon,
  Send as SendIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  HourglassEmpty as PendingIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import axios from 'axios';
import { styled } from '@mui/material/styles';
import Sidebar from '../common/Sidebar';
import { Template } from '../../types/template';
import { getDatabase } from '../../../server/src/db/db-sqlite';

// Interfaccia per le notifiche
interface Notification {
  id: number;
  appointment_id: number | null;
  patient_id: number;
  patient_name: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  type: 'appointment_confirmation' | 'appointment_reminder' | 'custom';
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  appointment_title?: string;
  appointment_date?: string;
  appointment_time?: string;
  phone_number?: string;
}

// Interfaccia per le statistiche
interface NotificationStats {
  pending_count: number;
  sent_count: number;
  failed_count: number;
  total_count: number;
  categories: {};
}

// Interfaccia per le notifiche di sistema
interface NotificationState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

// Interfaccia per i filtri
interface FilterState {
  status: string;
  type: string;
  patientId: string;
}

// Interfaccia per la paginazione
interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  pages: number;
}

// Componente per la pagina Notifiche
const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    sent_count: 0,
    failed_count: 0,
    total_count: 0,
    pending_count: 0,
    categories: {}
  });
  const [loading, setLoading] = useState(true);
  const [openSendDialog, setOpenSendDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openErrorDialog, setOpenErrorDialog] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [notification, setNotification] = useState<NotificationState>({
    open: false,
    message: '',
    severity: 'info'
  });
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    type: '',
    patientId: ''
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    pages: 1,
    total: 0
});
  const [patients, setPatients] = useState<{id: number, first_name: string, last_name: string}[]>([]);
  const [newNotification, setNewNotification] = useState({
    patient_id: '',
    message: ''
  });
  
  // Stati per i template
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | ''>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [requiredVariables, setRequiredVariables] = useState<string[]>([]);
  const [useTemplate, setUseTemplate] = useState<boolean>(false);
  
  // Stato per gli appuntamenti
  const [appointments, setAppointments] = useState<any[]>([]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', pagination?.page?.toString() ?? '1');
      queryParams.append('pageSize', pagination?.pageSize?.toString() ?? '10');
      
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.patientId) queryParams.append('patientId', filters.patientId);
      
      const response = await axios.get(`http://localhost:3001/api/notifications?${queryParams.toString()}`);
      console.log(response.data)
      
      // Verifichiamo che response.data.notifications esista prima di usare map
      if (!response.data || !Array.isArray(response.data.notifications)) {
        console.error('API response missing notifications array:', response.data);
        setNotifications([]);
        setPagination({
          page: response.data?.pagination?.page ?? 1,
          pageSize: response.data?.pagination?.pageSize ?? 10,
          pages: response.data?.pagination?.pages ?? 1,
          total: response.data?.pagination?.total ?? 0
        });
        const statsData = response.data.stats || {};
        setStats({
          sent_count: statsData.sent_count ?? 0,
          failed_count: statsData.failed_count ?? 0,
          total_count: statsData.total_count ?? 0,
          pending_count: statsData.pending_count ?? 0,
          categories: statsData.categories || {}
        });
        return;
      }

      setNotifications(response.data.notifications);
      setPagination(response.data.pagination);
      console.log('Dati statistiche:', response.data.stats);
      console.log('Notifiche ricevute:', response.data.notifications.length);

      // Aggiornamento corretto delle statistiche per i totalizzatori
      const statsData = response.data.stats || {};
      
      // Calcola le statistiche anche in base alle notifiche ricevute se stats non è disponibile
      const calculatedStats = {
        sent_count: statsData.sent_count ?? 0,
        failed_count: statsData.failed_count ?? 0,
        total_count: statsData.total_count ?? 0,
        pending_count: statsData.pending_count ?? 0,
        categories: statsData.categories || {}
      };
      
      // Se le statistiche dal server sono vuote, calcoliamole dalle notifiche
      if (!statsData.total_count && Array.isArray(response.data.notifications)) {
        calculatedStats.total_count = response.data.notifications.length;
        calculatedStats.sent_count = response.data.notifications.filter((n: Notification) => n.status === 'sent').length;
        calculatedStats.pending_count = response.data.notifications.filter((n: Notification) => n.status === 'pending').length;
        calculatedStats.failed_count = response.data.notifications.filter((n: Notification) => n.status === 'failed').length;
      }
      
      setStats(calculatedStats);
      
      // Aggiorniamo anche i contatori visualizzati nei totalizzatori
      document.querySelectorAll('.MuiTypography-h3').forEach((element, index) => {
        if (index === 0) element.textContent = String(calculatedStats.total_count);
        if (index === 1) element.textContent = String(calculatedStats.sent_count);
        if (index === 2) element.textContent = String(calculatedStats.pending_count);
        if (index === 3) element.textContent = String(calculatedStats.failed_count);
      });
      console.log('Dati statistiche elaborati:', calculatedStats);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
      setNotification({
        open: true,
        message: 'Errore nel caricamento delle notifiche',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Funzione per caricare le notifiche ogni 5 minuti invece che ogni 5 secondi
  useEffect(() => {
    const interval = setInterval(fetchNotifications, 300000); // 5 minuti = 300000 ms
    return () => clearInterval(interval);
  }, [fetchNotifications]);


  // Funzione per caricare i pazienti
  const fetchPatients = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/users');
      setPatients(response.data.map((user: any) => ({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name
      })));
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  // Funzione per caricare gli appuntamenti
  const fetchAppointments = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/appointments');
      setAppointments(response.data);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  // Carica i dati all'avvio
  useEffect(() => {
    fetchNotifications();
    fetchPatients();
    fetchAppointments();
  }, [pagination?.page, filters]);

  // Gestione del dialogo per inviare una nuova notifica
  const handleOpenSendDialog = () => {
    setOpenSendDialog(true);
  };

  const handleCloseSendDialog = () => {
    setOpenSendDialog(false);
    setNewNotification({
      patient_id: '',
      message: ''
    });
  };

  // Gestione del dialogo per eliminare una notifica
  const handleOpenDeleteDialog = (notification: Notification) => {
    setSelectedNotification(notification);
    setOpenDeleteDialog(true);
  };

  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setSelectedNotification(null);
  };

  // Gestione del dialogo per visualizzare l'errore
  const handleOpenErrorDialog = (notification: Notification) => {
    setSelectedNotification(notification);
    setOpenErrorDialog(true);
  };

  const handleCloseErrorDialog = () => {
    setOpenErrorDialog(false);
    setSelectedNotification(null);
  };

  // Questa funzione è stata spostata più in basso nel codice
  // per evitare la duplicazione che causava l'errore di compilazione

  // Funzione per reinviare una notifica
  const handleResendNotification = async (id: number) => {
    try {
      setNotification({
        open: true,
        message: 'Reinvio in corso...',
        severity: 'info'
      });
      
      await axios.post(`http://localhost:3001/api/notifications/${id}/resend`);
      
      setNotification({
        open: true,
        message: 'Notifica reinviata con successo',
        severity: 'success'
      });
      
      fetchNotifications();
    } catch (error) {
      console.error('Error resending notification:', error);
      setNotification({
        open: true,
        message: 'Errore durante il reinvio della notifica',
        severity: 'error'
      });
    }
  };

  // Funzione per eliminare una notifica
  const handleDeleteNotification = async () => {
    if (!selectedNotification) return;
    
    try {
      setNotification({
        open: true,
        message: 'Eliminazione in corso...',
        severity: 'info'
      });
      
      await axios.delete(`http://localhost:3001/api/notifications/${selectedNotification.id}`);
      
      setNotification({
        open: true,
        message: 'Notifica eliminata con successo',
        severity: 'success'
      });
      
      handleCloseDeleteDialog();
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', (error as { response?: { data: unknown } })?.response?.data || error);
      setNotification({
        open: true,
        message: 'Errore durante l\'eliminazione della notifica',
        severity: 'error'
      });
    }
  };

  // Funzione per elaborare tutte le notifiche in attesa
  const handleProcessPendingNotifications = async () => {
    try {
      setNotification({
        open: true,
        message: 'Elaborazione notifiche in corso...',
        severity: 'info'
      });
      
      const response = await axios.post('http://localhost:3001/api/notifications/process');
      
      setNotification({
        open: true,
        message: response.data.message,
        severity: 'success'
      });
      
      fetchNotifications();
    } catch (error) {
      console.error('Error processing notifications:', error);
      setNotification({
        open: true,
        message: 'Errore durante l\'elaborazione delle notifiche',
        severity: 'error'
      });
    }
  };

  // Funzione per processare una singola notifica in attesa
  const handleProcessSingleNotification = async (id: number) => {
    try {
      setNotification({
        open: true,
        message: 'Invio notifica WhatsApp in corso...',
        severity: 'info'
      });
      
      const response = await axios.post(`http://localhost:3001/api/notifications/process/${id}`);
      
      setNotification({
        open: true,
        message: 'Notifica WhatsApp inviata con successo',
        severity: 'success'
      });
      
      fetchNotifications();
    } catch (error: any) {
      console.error('Error processing notification:', error);
      setNotification({
        open: true,
        message: `Errore durante l'invio della notifica WhatsApp: ${error.response?.data?.error || error.message}`,
        severity: 'error'
      });
    }
  };

  // Gestione della chiusura delle notifiche di sistema
  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  // Gestione dei filtri
  const handleFilterChange = (field: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Gestione della paginazione
  const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
    setPagination(prev => ({
      ...prev,
      page: value,
      pageSize: prev?.pageSize ?? 10,
      pages: prev?.pages ?? 1,
      total: prev?.total ?? 0
    }));
  };

  // Funzione per ottenere il colore dello stato
  const getStatusColor = (status: string): AlertColor => {
    switch (status) {
      case 'sent':
        return 'success';
      case 'pending':
        return 'info';
      case 'failed':
        return 'error';
      default:
        return 'default' as AlertColor;
    }
  };

  // Funzione per tradurre lo stato
  const translateStatus = (status: string): string => {
    switch (status) {
      case 'sent':
        return 'Inviata';
      case 'pending':
        return 'In attesa';
      case 'failed':
        return 'Fallita';
      default:
        return status;
    }
  };

  // Funzione per tradurre il tipo
  const translateType = (type: string): string => {
    switch (type) {
      case 'appointment_confirmation':
        return 'Conferma appuntamento';
      case 'appointment_reminder':
        return 'Promemoria appuntamento';
      case 'custom':
        return 'Personalizzata';
      default:
        return type;
    }
  };

  // Funzione per formattare la data
  const formatDate = (dateString: string | null): string => {
    if (!dateString) return '-';
    
    const options: Intl.DateTimeFormatOptions = { 
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return new Date(dateString).toLocaleDateString('it-IT', options);
  };
  
  // Funzione per caricare i template
  const fetchTemplates = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/templates');
      console.log('Template API Response:', response.data);
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
  
  // Carica i template all'avvio
  useEffect(() => {
    fetchTemplates();
  }, []);
  
  // Funzione per estrarre le variabili da un template
  const extractVariables = (content: string): string[] => {
    const regex = /{{([^}]+)}}/g;
    const matches = content.matchAll(regex);
    const variables: string[] = [];
    
    for (const match of matches) {
      if (match[1] && match[1] !== 'patient_name' && !variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    return variables;
  };
  
  // Funzione per inizializzare le variabili del template con valori predefiniti
  const initializeTemplateVariables = (variables: string[]): Record<string, string> => {
    const initialVariables: Record<string, string> = {};
    variables.forEach(v => {
      // Inizializza con valori vuoti o predefiniti in base al tipo di variabile
      if (v === 'appointment_title') {
        initialVariables[v] = '';
      } else if (v === 'appointment_date') {
        initialVariables[v] = new Date().toLocaleDateString('it-IT');
      } else if (v === 'appointment_time') {
        initialVariables[v] = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      } else {
        initialVariables[v] = '';
      }
    });
    return initialVariables;
  };
  
  // Gestione del cambio template
  const handleTemplateChange = (event: SelectChangeEvent<number>, child: React.ReactNode) => {
    const templateId = event.target.value as number;
    setSelectedTemplate(templateId);
    
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        const variables = extractVariables(template.content);
        setRequiredVariables(variables);
        
        // Inizializza le variabili con valori predefiniti
        const initialVariables = initializeTemplateVariables(variables);
        setTemplateVariables(initialVariables);
        
        // Se il template è per modifica o cancellazione appuntamento, carica gli appuntamenti
        if (template.type === 'appointment_update' || template.type === 'appointment_cancellation') {
          fetchAppointments();
        }
      }
    } else {
      setRequiredVariables([]);
      setTemplateVariables({});
    }
  };
  
  // Gestione del cambio variabile
  const handleVariableChange = (variable: string, value: string) => {
    setTemplateVariables(prev => ({
      ...prev,
      [variable]: value
    }));
  };
  
  // Funzione per inviare una notifica con template
  const handleSendNotificationWithTemplate = async () => {
    try {
      setNotification({
        open: true,
        message: 'Invio in corso...',
        severity: 'info'
      });

      await axios.post('http://localhost:3001/api/notifications/template', {
        user_id: newNotification.patient_id,
        template_id: selectedTemplate,
        variables: templateVariables,
        appointment_id: appointments.find(a => a.patient_id === newNotification.patient_id)?.id || null
      });

      setNotification({
        open: true,
        message: 'Notifica inviata con successo',
        severity: 'success'
      });

      handleCloseSendDialog();

      fetchNotifications();
    } catch (error) {
      console.error('Error sending notification with template:', (error as { response?: { data: unknown } })?.response?.data || error);
  
      setNotification({
        open: true,
        message: 'Errore durante l\'invio della notifica',
        severity: 'error'
      });
    }
  };
  
  // Funzione per inviare una notifica
  const handleSendNotification = async () => {
    if (useTemplate && selectedTemplate) {
      await handleSendNotificationWithTemplate();
      return;
    }
    
    try {
      setNotification({
        open: true,
        message: 'Invio in corso...',
        severity: 'info'
      });

      await axios.post('http://localhost:3001/api/notifications', newNotification);

      setNotification({
        open: true,
        message: 'Notifica inviata con successo',
        severity: 'success'
      });

      handleCloseSendDialog();

      fetchNotifications();
    } catch (error) {
      console.error('Error sending notification:', error);
  
      setNotification({
        open: true,
        message: 'Errore durante l\'invio della notifica',
        severity: 'error'
      });
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3, ml: '0px' }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          mb: 3 
        }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold' }}>
            Notifiche
          </Typography>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleOpenSendDialog}
            sx={{ 
              borderRadius: 2,
              boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
            }}
          >
            Invia Notifica
          </Button>
        </Box>

        {/* Statistiche */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              borderRadius: 2, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              height: '100%'
            }}>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Totale Notifiche
                </Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 'bold' }}>
                  {stats.total_count}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              borderRadius: 2, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              height: '100%',
              borderLeft: '4px solid #4caf50'
            }}>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Inviate
                </Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: '#4caf50' }}>
                  {stats.sent_count}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              borderRadius: 2, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              height: '100%',
              borderLeft: '4px solid #2196f3'
            }}>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  In Attesa
                </Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: '#2196f3' }}>
                  {stats.pending_count}
                </Typography>
                {stats.pending_count > 0 && (
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<SendIcon />}
                    onClick={handleProcessPendingNotifications}
                    sx={{ mt: 1 }}
                  >
                    Invia tutte
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ 
              borderRadius: 2, 
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              height: '100%',
              borderLeft: '4px solid #f44336'
            }}>
              <CardContent>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Fallite
                </Typography>
                <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', color: '#f44336' }}>
                  {stats.failed_count}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filtri */}
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Stato</InputLabel>
            <Select
              value={filters.status}
              label="Stato"
              onChange={(e) => handleFilterChange('status', e.target.value)}
              size="small"
            >
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="sent">Inviata</MenuItem>
              <MenuItem value="pending">In attesa</MenuItem>
              <MenuItem value="failed">Fallita</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Tipo</InputLabel>
            <Select
              value={filters.type}
              label="Tipo"
              onChange={(e) => handleFilterChange('type', e.target.value)}
              size="small"
            >
              <MenuItem value="">Tutti</MenuItem>
              <MenuItem value="appointment_confirmation">Conferma appuntamento</MenuItem>
              <MenuItem value="appointment_reminder">Promemoria appuntamento</MenuItem>
              <MenuItem value="custom">Personalizzata</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Paziente</InputLabel>
            <Select
              value={filters.patientId}
              label="Paziente"
              onChange={(e) => handleFilterChange('patientId', e.target.value)}
              size="small"
            >
              <MenuItem value="">Tutti</MenuItem>
              {patients.map((patient) => (
                <MenuItem key={patient.id} value={patient.id.toString()}>
                  {patient.first_name} {patient.last_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Button 
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              setFilters({ status: '', type: '', patientId: '' }),
              setPagination((prev) => ({ ...prev, page: 1 }))
            }}>
            Reset filtri
          </Button>
        </Box>

        {/* Tabella delle notifiche */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress />
          </Box>
        ) : notifications.length === 0 ? (
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
            <InfoIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Nessuna notifica trovata
            </Typography>
            <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
              Non ci sono notifiche che corrispondono ai filtri selezionati.
            </Typography>
            <Button 
              variant="contained" 
              startIcon={<AddIcon />} 
              onClick={handleOpenSendDialog}
            >
              Invia Notifica
            </Button>
          </Box>
        ) : (
          <>
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Stato</TableCell>
                    <TableCell>Utente</TableCell>
                    <TableCell>Tipo</TableCell>
                    <TableCell>Messaggio</TableCell>
                    <TableCell>Data creazione</TableCell>
                    <TableCell>Data invio</TableCell>
                    <TableCell>Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notifications?.map((notification) => (
                    <TableRow key={notification.id}>
                      <TableCell>
                        <Chip 
                          label={translateStatus(notification.status)} 
                          color={getStatusColor(notification.status)}
                          size="small"
                          icon={
                            notification.status === 'sent' ? <CheckCircleIcon /> : 
                            notification.status === 'pending' ? <PendingIcon /> : 
                            <ErrorIcon />
                          }
                        />
                      </TableCell>
                      <TableCell>{notification.patient_name}</TableCell>
                      <TableCell>{translateType(notification.type)}</TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            maxWidth: 250, 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap' 
                          }}
                        >
                          {notification.message}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(notification.created_at)}</TableCell>
                      <TableCell>{formatDate(notification.sent_at)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex' }}>
                          {notification.status === 'pending' && (
                            <Tooltip title="Invia">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleProcessSingleNotification(notification.id)}
                              >
                                <SendIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {notification.status === 'failed' && (
                            <Tooltip title="Reinvia">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleResendNotification(notification.id)}
                              >
                                <SendIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {notification.status === 'failed' && (
                            <Tooltip title="Visualizza errore">
                              <IconButton 
                                size="small" 
                                color="warning"
                                onClick={() => handleOpenErrorDialog(notification)}
                              >
                                <ErrorIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Elimina">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleOpenDeleteDialog(notification)}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {/* Paginazione */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination
            count={pagination?.pages ?? 1}
            page={pagination?.page ?? 1}
            onChange={handlePageChange}
            color="primary"
            showFirstButton
            showLastButton
          />
            </Box>
          </>
        )}

        {/* Dialog per inviare una nuova notifica */}
        <Dialog 
          open={openSendDialog}
          onClose={handleCloseSendDialog}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>Invia nuova notifica</DialogTitle>
          <DialogContent>
            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel>Utente</InputLabel>
              <Select
                value={newNotification.patient_id}
                label="Utente"
                onChange={(e) => setNewNotification(prev => ({ ...prev, patient_id: e.target.value as string }))}
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
                    {templates?.map((template) => (
                      <MenuItem key={template.id} value={template.id}>
                        {template.name}
                      </MenuItem>
                    )) ?? []}
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
                    {/* Se il template è per modifica o cancellazione appuntamento, mostra la select per scegliere l'appuntamento */}
                {(templates.find(t => t.id === selectedTemplate)?.type === 'appointment_update' || 
                 templates.find(t => t.id === selectedTemplate)?.type === 'appointment_cancellation') && (
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Seleziona Appuntamento</InputLabel>
                    <Select
                      value={templateVariables['appointment_id'] || ''}
                      label="Seleziona Appuntamento"
                      onChange={(e) => {
                        const appointmentId = e.target.value;
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
                          handleVariableChange('appointment_title', appointment.title);
                          handleVariableChange('appointment_date', formattedDate);
                          handleVariableChange('appointment_time', appointment.time);
                        }
                      }}
                    >
                      <MenuItem value="">
                        <em>Seleziona un appuntamento</em>
                      </MenuItem>
                      {appointments.map((appointment) => (
                        <MenuItem key={appointment.id} value={appointment.id.toString()}>
                          {appointment.title} - {new Date(appointment.date).toLocaleDateString('it-IT')} {appointment.time}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Seleziona un appuntamento esistente per compilare automaticamente i campi
                    </FormHelperText>
                  </FormControl>
                )}
                
                {requiredVariables.map((variable) => {
                  // Nascondi i campi che vengono compilati automaticamente quando si seleziona un appuntamento
                  if ((templates.find(t => t.id === selectedTemplate)?.type === 'appointment_update' || 
                      templates.find(t => t.id === selectedTemplate)?.type === 'appointment_cancellation') && 
                      (variable === 'appointment_title' || variable === 'appointment_date' || 
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
                        /{{([^}]+)}}/g,
                        (match, variable) => {
                          if (variable === 'patient_name') {
                            const patient = patients.find(p => p.id.toString() === newNotification.patient_id);
                            return patient ? `${patient.first_name} ${patient.last_name}` : match;
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
                value={newNotification.message}
                onChange={(e) => setNewNotification(prev => ({ ...prev, message: e.target.value }))}
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseSendDialog}>Annulla</Button>
            <Button 
              onClick={handleSendNotification} 
              variant="contained"
              disabled={
                !newNotification.patient_id || 
                (useTemplate ? !selectedTemplate : !newNotification.message)
              }
            >
              Invia
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Dialog per eliminare una notifica */}
        <Dialog
          open={openDeleteDialog}
          onClose={handleCloseDeleteDialog}
        >
          <DialogTitle>Elimina notifica</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Sei sicuro di voler eliminare questa notifica? Questa azione non può essere annullata.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDeleteDialog}>Annulla</Button>
            <Button onClick={handleDeleteNotification} color="error" variant="contained">
              Elimina
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialog per visualizzare l'errore */}
        <Dialog
          open={openErrorDialog}
          onClose={handleCloseErrorDialog}
        >
          <DialogTitle>Dettagli errore</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {selectedNotification?.error_message || 'Nessun dettaglio disponibile sull\'errore.'}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseErrorDialog}>Chiudi</Button>
            <Button 
              onClick={() => {
                if (selectedNotification) {
                  handleResendNotification(selectedNotification.id);
                  handleCloseErrorDialog();
                }
              }} 
              color="primary" 
              variant="contained"
            >
              Riprova
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar per le notifiche di sistema */}
        <Snackbar 
          open={notification.open} 
          autoHideDuration={6000} 
          onClose={handleCloseNotification} 
          sx={{ width: '100%' }}
        >
          <Alert 
            onClose={handleCloseNotification}
            severity={notification.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
}; // Close the Notifications component

export default Notifications;
