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
  FormHelperText,
  Checkbox
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
import { notificationService } from '../../services/notification.service';
import NotificationSender from './NotificationSender';

// Interfaccia per le notifiche
interface Notification {
  id: number;
  appointment_id: number | null;
  patient_id: number;
  user_id: number;
  patient_name: string;
  first_name?: string;
  last_name?: string;
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
  selected?: boolean; // Per la selezione multipla
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
  userId: string; // Cambiato da patientId a userId
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
    userId: ''
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 10,
    pages: 1,
    total: 0
  });
  // Stati per la selezione multipla
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<number[]>([]);
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
  
  // Stato per gli appuntamenti filtrati per utente selezionato nel dialog
  const [filteredAppointments, setFilteredAppointments] = useState<any[]>([]);
  
  // Stato per gli appuntamenti (sembra ridondante, verificare se necessario o rimuovere)
  const [appointments, setAppointments] = useState<any[]>([]);
  
  // Stato per l'invio automatico di WhatsApp
  const [autoSendWhatsApp, setAutoSendWhatsApp] = useState<boolean>(false);

  // Stato per il nome della clinica
  const [clinicName, setClinicName] = useState<string>('');

  // Nuovo stato per il caricamento del dialogo di invio
  const [isSendDialogLoading, setIsSendDialogLoading] = useState(false);

  // Effetto per reagire ai cambiamenti dei filtri

  // Rimosso useEffect per fetchClinicName al mount

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', pagination?.page?.toString() ?? '1');
      queryParams.append('pageSize', pagination?.pageSize?.toString() ?? '10');
      
      // Applica i filtri alla query
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.userId) queryParams.append('user_id', filters.userId);
      
      // Aggiungi l'ordinamento per data di creazione
      queryParams.append('sort', 'created_at');
      queryParams.append('order', 'desc');
      
      console.log('Parametri di filtro:', Object.fromEntries(queryParams));
      // Assicuriamoci che l'URL sia corretto e che i parametri vengano passati correttamente
      const response = await axios.get(`http://localhost:3001/api/notifications?${queryParams.toString()}`);
      console.log('Risposta API notifiche:', response.data);
      
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

      // Assicuriamoci che ogni notifica abbia i campi necessari
      const processedNotifications = response.data.notifications.map((notification: Notification) => ({
        ...notification,
        selected: selectedNotifications.includes(notification.id) // Mantieni lo stato di selezione
      }));

      setNotifications(processedNotifications);
      setPagination(response.data.pagination);
      console.log('Dati statistiche:', response.data.stats);
      console.log('Notifiche ricevute:', processedNotifications.length);

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
      if (!statsData.total_count && Array.isArray(processedNotifications)) {
        calculatedStats.total_count = processedNotifications.length;
        calculatedStats.sent_count = processedNotifications.filter((n: Notification) => n.status === 'sent').length;
        calculatedStats.pending_count = processedNotifications.filter((n: Notification) => n.status === 'pending').length;
        calculatedStats.failed_count = processedNotifications.filter((n: Notification) => n.status === 'failed').length;
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
  }, [filters, pagination, selectedNotifications]);
  
  // Effetto per reagire ai cambiamenti dei filtri
  useEffect(() => {
    // Forziamo il ricaricamento delle notifiche quando cambiano i filtri
    const timer = setTimeout(() => {
      fetchNotifications();
    }, 1000); // Aumentiamo il debounce a 1000ms per ridurre il carico sul server
    
    return () => clearTimeout(timer);
  }, [filters, pagination?.page, pagination?.pageSize]); // Rimosso fetchNotifications dalle dipendenze per evitare loop infiniti

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
  const fetchAppointments = async (userId = ''): Promise<any[]> => {
    try {
      let url = 'http://localhost:3001/api/appointments';
      const params: Record<string, string> = {};

      console.log('User:', userId);
      
      // Se userId è fornito, usa l'endpoint specifico per paziente
      if (userId) {
        url = `http://localhost:3001/api/appointments/patient/${userId}`;
      } else {
        // Altrimenti, potresti voler aggiungere altri parametri generali qui se necessario
        // Esempio: params['status'] = 'scheduled';
      }
      
      // Esegui la richiesta GET. Se l'URL è stato modificato per includere userId, non servono parametri aggiuntivi per quello.
      // Se l'URL è quello generale, puoi passare i parametri qui.
      const response = await axios.get(url, { params: Object.keys(params).length > 0 ? params : undefined });
      console.log(`[fetchAppointments] URL: ${url}, Params: ${JSON.stringify(params)}, Response:`, response.data);
      return response.data || []; // Restituisce i dati o un array vuoto
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setNotification({
        open: true,
        message: 'Errore nel caricamento degli appuntamenti per l\'utente.',
        severity: 'error'
      });
      return []; // Restituisce un array vuoto in caso di errore
    }
  };

  // Carica i dati all'avvio e quando cambiano i filtri o la paginazione
  // Funzione per caricare le impostazioni generali (incluso il nome della clinica)
  const fetchGeneralSettings = async (): Promise<string> => { // Modificato per restituire una stringa
    try {
      console.log('[Frontend] Fetching general settings...'); // Log inizio fetch
      const response = await axios.get('http://localhost:3001/api/settings/general');
      console.log('[Frontend] General settings response:', response.data); // Log risposta
      if (response.data && response.data.value) {
        try {
          const settingsValue = JSON.parse(response.data.value);
          if (settingsValue && settingsValue.clinicName) {
            console.log('[Frontend] Fetched/Refreshed clinic name:', settingsValue.clinicName); // Log aggiornato
            return settingsValue.clinicName; // Restituisce il nome della clinica dal JSON parsato
          } else {
            console.log('[Frontend] Clinic name not found within the parsed settings value.');
            return ''; // Restituisce stringa vuota se clinicName non è nel JSON
          }
        } catch (parseError) {
          console.error('[Frontend] Error parsing general settings value:', parseError);
          console.log('[Frontend] Reset clinic name due to parsing error.');
          return ''; // Restituisce stringa vuota in caso di errore di parsing
        }
      } else {
        console.log('[Frontend] General settings response or value field is missing.');
        return ''; // Restituisce stringa vuota se la risposta o il campo value mancano
      }
    } catch (error) {
      console.error('Error fetching general settings:', error);
      console.log('[Frontend] Reset clinic name due to fetch error.'); // Log errore
      return ''; // Restituisce stringa vuota in caso di errore
    }
  };

  // Carica i dati all'avvio
  useEffect(() => {
    fetchPatients();
    // Carica tutti gli appuntamenti all'inizio e imposta lo stato principale
    const loadInitialAppointments = async () => {
      const allAppointments = await fetchAppointments();
      setAppointments(allAppointments);
    };
    loadInitialAppointments();
    // Il nome della clinica viene già caricato nell'altro useEffect
  }, []);
  
  // Stato per tenere traccia se il template selezionato contiene variabili di appuntamento
  const [hasAppointmentVariables, setHasAppointmentVariables] = useState(false);
  // Stato per gli appuntamenti filtrati per utente
  //const [filteredAppointments, setFilteredAppointments] = useState<any[]>([]);

  // Gestione del dialogo per inviare una nuova notifica
  const handleOpenSendDialog = async () => {
    setIsSendDialogLoading(true); // Inizia il caricamento
    setOpenSendDialog(true); // Apri subito il dialogo (mostrerà lo stato di caricamento)
    try {
      // Resetta gli stati prima
      setSelectedTemplate('');
      setTemplateVariables({});
      setRequiredVariables([]);
      setHasAppointmentVariables(false);
      setUseTemplate(false);
      setNewNotification({
        patient_id: '',
        message: ''
      });
      setFilteredAppointments([]); // Resetta anche gli appuntamenti filtrati
      // Non resettare clinicName qui, verrà sovrascritto dal fetch

      // Recupera il nome della clinica
      const fetchedClinicName = await fetchGeneralSettings(); // Usa la funzione esistente
      setClinicName(fetchedClinicName); // Imposta lo stato
      console.log('[handleOpenSendDialog] Clinic Name set:', fetchedClinicName);

    } catch (error) {
      console.error('Error preparing send dialog:', error);
      setNotification({
        open: true,
        message: 'Errore nell\'apertura del dialogo di invio. Impossibile recuperare il nome della clinica.',
        severity: 'error'
      });
      // Opzionalmente chiudi il dialogo in caso di errore o mantienilo aperto con il messaggio di errore
      // setOpenSendDialog(false);
    } finally {
      setIsSendDialogLoading(false); // Termina il caricamento
    }
  };

  const handleCloseSendDialog = () => {
    setOpenSendDialog(false);
    setNewNotification({
      patient_id: '',
      message: ''
    });
    setSelectedTemplate('');
    setTemplateVariables({});
    setRequiredVariables([]);
    setHasAppointmentVariables(false);
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

  // Funzione per gestire il cambio di utente e caricare i suoi appuntamenti
  const handleUserChange = async (userId: string) => {
    setNewNotification(prev => ({ ...prev, patient_id: userId }));
    console.log('User changed, selected userId:', userId); // Log userId
    if (userId) {
      try {
        // Fetch appointments for the selected user
        const response = await axios.get(`http://localhost:3001/api/appointments/patient/${userId}`);
        // --- START DEBUG LOGGING ---
        console.log('Raw response from API:', response);
        console.log('Raw response.data from API:', response.data);
        // --- END DEBUG LOGGING ---
        // Ensure userAppointments is always an array
        const userAppointments = Array.isArray(response.data) ? response.data : []; 
        console.log('Fetched appointments for user:', userAppointments); // Log fetched appointments
        setFilteredAppointments(userAppointments);
      } catch (error) {
        console.error('Error fetching appointments for user:', error);
        setFilteredAppointments([]);
        // Optionally, show an error notification to the user
        setNotification({
          open: true,
          message: 'Errore nel caricamento degli appuntamenti per l\'utente.',
          severity: 'error'
        });
      }
    } else {
      setFilteredAppointments([]);
    }
  };
  
  // Funzione per gestire il cambio di template
  const handleTemplateChange = (event: SelectChangeEvent<number | string>) => {
    const templateId = event.target.value as number | '';
    setSelectedTemplate(templateId);
    
    if (templateId === '') {
      setRequiredVariables([]);
      setTemplateVariables({});
      setHasAppointmentVariables(false);
      return;
    }
    
    const template = templates.find(t => t.id === templateId);
    if (!template) return;
    
    // Estrai le variabili dal contenuto del template
    const regex = /\{\{([^}]+)\}\}/g;
    const matches = template.content.matchAll(regex);
    const variables: string[] = [];
    
    for (const match of matches) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }
    
    setRequiredVariables(variables);
    
    // Controlla se ci sono variabili relative agli appuntamenti
    const appointmentVars = ['appointment_title', 'appointment_date', 'appointment_time', 'appointment_id'];
    const hasAppVars = variables.some(v => appointmentVars.includes(v));
    setHasAppointmentVariables(hasAppVars);
    
    // Resetta le variabili del template
    setTemplateVariables({});
  };
  
  // Funzione per gestire il cambio di valore delle variabili
  const handleVariableChange = (variable: string, value: string) => {
    setTemplateVariables(prev => ({
      ...prev,
      [variable]: value
    }));
  };
  
  // Funzione per gestire la selezione di un appuntamento
  const handleAppointmentSelect = (appointmentId: string) => {
    // Utilizza filteredAppointments invece di appointments per coerenza con la dropdown
    const appointment = filteredAppointments.find(a => a.id.toString() === appointmentId);
    if (appointment) {
      // Formatta la data per una migliore leggibilità
      const formattedDate = new Date(appointment.appointment_date || appointment.date).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      
      // Aggiorna tutte le variabili relative all'appuntamento
      handleVariableChange('appointment_id', appointmentId);
      handleVariableChange('appointment_title', appointment.title || '');
      handleVariableChange('appointment_date', formattedDate);
      handleVariableChange('appointment_time', appointment.appointment_time || appointment.time || '');
    }
  };
  
  // Funzione per elaborare tutte le notifiche in attesa o quelle selezionate
  const handleProcessPendingNotifications = async () => {
    try {
      setNotification({
        open: true,
        message: 'Elaborazione notifiche in corso...',
        severity: 'info'
      });
      
      if (selectedNotifications.length > 0) {
        // Elaborazione delle notifiche selezionate
        for (const id of selectedNotifications) {
          if (autoSendWhatsApp) {
            // Usa l'invio automatico per le notifiche selezionate
            await handleProcessSingleNotification(id, true);
          } else {
            await axios.post(`http://localhost:3001/api/notifications/process/${id}`);
          }
        }
        
        setNotification({
          open: true,
          message: `${selectedNotifications.length} notifiche elaborate con successo`,
          severity: 'success'
        });
        
        setSelectedNotifications([]);
        setSelectMode(false);
      } else {
        // Elaborazione di tutte le notifiche in attesa
        if (autoSendWhatsApp) {
          // Ottieni tutte le notifiche in attesa
          const pendingResponse = await axios.get('http://localhost:3001/api/notifications?status=pending');
          if (pendingResponse.data && Array.isArray(pendingResponse.data.notifications)) {
            const pendingNotifications = pendingResponse.data.notifications;
            
            // Processa ogni notifica in attesa con invio automatico
            for (const notification of pendingNotifications) {
              await handleProcessSingleNotification(notification.id, true);
            }
            
            setNotification({
              open: true,
              message: `${pendingNotifications.length} notifiche elaborate con successo`,
              severity: 'success'
            });
          }
        } else {
          // Usa il metodo standard senza invio automatico
          const response = await axios.post('http://localhost:3001/api/notifications/process');
          
          setNotification({
            open: true,
            message: response.data.message || 'Notifiche elaborate con successo',
            severity: 'success'
          });
        }
      }
      
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
  
  // Funzione per eliminare le notifiche selezionate
  const handleDeleteSelectedNotifications = async () => {
    if (selectedNotifications.length === 0) return;
    
    try {
      setNotification({
        open: true,
        message: 'Eliminazione notifiche in corso...',
        severity: 'info'
      });
      
      for (const id of selectedNotifications) {
        await axios.delete(`http://localhost:3001/api/notifications/${id}`);
      }
      
      setNotification({
        open: true,
        message: `${selectedNotifications.length} notifiche eliminate con successo`,
        severity: 'success'
      });
      
      setSelectedNotifications([]);
      setSelectMode(false);
      fetchNotifications();
    } catch (error) {
      console.error('Error deleting notifications:', error);
      setNotification({
        open: true,
        message: 'Errore durante l\'eliminazione delle notifiche',
        severity: 'error'
      });
    }
  };

  // Funzione per processare una singola notifica in attesa
  const handleProcessSingleNotification = async (id: number, autoSend: boolean = false) => {
    try {
      setNotification({
        open: true,
        message: 'Invio notifica WhatsApp in corso...',
        severity: 'info'
      });
      
      // Ottieni i dettagli della notifica
      const notificationResponse = await axios.get(`http://localhost:3001/api/notifications/${id}`);
      const notificationData = notificationResponse.data;
      
      if (!notificationData) {
        throw new Error('Notifica non trovata');
      }
      
      // Ottieni il numero di telefono dell'utente
      const userResponse = await axios.get(`http://localhost:3001/api/users/${notificationData.user_id}`);
      const phoneNumber = userResponse.data.phone;
      
      if (!phoneNumber) {
        throw new Error('L\'utente non ha un numero di telefono');
      }
      
      // Invia la notifica tramite WhatsApp con l'opzione di invio automatico
      await notificationService.sendWhatsAppNotification(phoneNumber, notificationData.message, autoSend);
      
      // Aggiorna lo stato della notifica nel database
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
    // Non chiamiamo fetchNotifications qui perché verrà chiamato dall'useEffect
  };
  
  // Funzione per gestire la selezione/deselezione di una notifica
  const handleSelectNotification = (id: number) => {
    if (selectedNotifications.includes(id)) {
      setSelectedNotifications(prev => prev.filter(notificationId => notificationId !== id));
    } else {
      setSelectedNotifications(prev => [...prev, id]);
    }
  };
  
  // Funzione per attivare/disattivare la modalità selezione
  const toggleSelectMode = () => {
    setSelectMode(prev => !prev);
    if (selectMode) {
      setSelectedNotifications([]);
    }
  };
  
  // Funzione per selezionare/deselezionare tutte le notifiche
  const handleSelectAll = () => {
    if (selectedNotifications.length === notifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(notifications.map(n => n.id));
    }
  };
  
  // Funzione per verificare se una notifica è selezionata
  const isNotificationSelected = (id: number): boolean => {
    return selectedNotifications.includes(id);
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
      case 'appointment_created':
        return 'Appuntamento creato';
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
  
  // Gestione del cambio template (seconda implementazione)
  const handleTemplateChangeAdvanced = (event: SelectChangeEvent<number>, child: React.ReactNode) => {
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
        
        // Controlla se ci sono variabili relative agli appuntamenti
        const appointmentVars = ['appointment_title', 'appointment_date', 'appointment_time', 'appointment_id'];
        const hasAppVars = variables.some(v => appointmentVars.includes(v));
        
        // Imposta sempre a true per mostrare la select degli appuntamenti quando è selezionato un template
        setHasAppointmentVariables(true);
        
        // Se il template è per modifica o cancellazione appuntamento, carica gli appuntamenti
        if (template.type === 'appointment_update' || template.type === 'appointment_cancellation'|| template.type === 'appointment_remainder') {
          fetchAppointments();
        }
        
        // Aggiorna gli appuntamenti filtrati se c'è un utente selezionato
        // La logica è stata rimossa perché gestita da handleUserChange
      }
    } else {
      setRequiredVariables([]);
      setTemplateVariables({});
      setHasAppointmentVariables(false);
    }
  };
  
  // Gestione del cambio variabile (seconda implementazione)
  const handleVariableChangeAdvanced = (variable: string, value: string) => {
    setTemplateVariables(prev => ({
      ...prev,
      [variable]: value
    }));
  };
  
  // Funzione per inviare una notifica con template
  const handleSendNotificationWithTemplate = async () => {
    try {
      console.log('🔄 [INVIO NOTIFICA CON TEMPLATE] Inizio processo di invio notifica con template');
      console.log('📋 Dati notifica:', {
        user_id: newNotification.patient_id,
        template_id: selectedTemplate,
        variables: templateVariables,
        appointment_id: appointments.find(a => a.patient_id === newNotification.patient_id)?.id || null
      });
      
      setNotification({
        open: true,
        message: 'Invio in corso...',
        severity: 'info'
      });

      // Ottieni il numero di telefono dell'utente
      console.log(`🔍 Recupero numero di telefono per l'utente ID: ${newNotification.patient_id}`);
      const userResponse = await axios.get(`http://localhost:3001/api/users/${newNotification.patient_id}`);
      console.log('✅ Risposta API utente:', userResponse.data);
      const phoneNumber = userResponse.data.phone;
      
      if (!phoneNumber) {
        console.error('❌ Utente senza numero di telefono');
        setNotification({
          open: true,
          message: 'L\'utente selezionato non ha un numero di telefono',
          severity: 'error'
        });
        return;
      }
      console.log(`📱 Numero di telefono trovato: ${phoneNumber}`);

      // Salva la notifica nel database
      console.log('💾 Salvataggio notifica nel database...');
      const payload = {
        user_id: newNotification.patient_id,
        template_id: selectedTemplate,
        variables: templateVariables,
        appointment_id: appointments.find(a => a.patient_id === newNotification.patient_id)?.id || null
      };
      console.log('📤 Payload richiesta:', payload);
      
      const response = await axios.post('http://localhost:3001/api/notifications/template', payload);
      console.log('📥 Risposta salvataggio notifica:', response.data);

      // Ottieni il template e sostituisci le variabili
      console.log(`🔍 Recupero template ID: ${selectedTemplate}`);
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        console.log('✅ Template trovato:', template.name);
        const patient = patients.find(p => p.id.toString() === newNotification.patient_id);
        if (patient) {
          console.log('👤 Paziente trovato:', `${patient.first_name} ${patient.last_name}`);
          // Prepara le variabili per la sostituzione
          const variables = {
            ...templateVariables,
            first_name: patient.first_name,
            last_name: patient.last_name,
            patient_name: `${patient.first_name} ${patient.last_name}`,
            clinic_name: clinicName // Aggiungi clinicName alle variabili
          };
          console.log('🔄 Variabili per sostituzione:', variables);
          
          // Sostituisci le variabili nel template
          console.log('🔄 Sostituzione variabili nel template...');
          const message = notificationService.replaceTemplateVariables(template.content, variables);
          console.log('📝 Messaggio finale:', message);
          
          // Invia la notifica tramite WhatsApp
          console.log('📲 Invio notifica WhatsApp...');
          await notificationService.sendWhatsAppNotification(phoneNumber, message);
          console.log('✅ Notifica WhatsApp inviata con successo');
          
          // Aggiorna lo stato della notifica nel database
          if (response.data && response.data.id) {
            console.log(`🔄 Aggiornamento stato notifica ID: ${response.data.id}`);
            await axios.post(`http://localhost:3001/api/notifications/process/${response.data.id}`);
            console.log('✅ Stato notifica aggiornato con successo');
          }
        } else {
          console.error('❌ Paziente non trovato');
        }
      } else {
        console.error(`❌ Template ID ${selectedTemplate} non trovato`);
      }

      console.log('✅ Processo di invio notifica completato con successo');
      setNotification({
        open: true,
        message: 'Notifica inviata con successo',
        severity: 'success'
      });

      handleCloseSendDialog();

      fetchNotifications();
    } catch (error) {
      console.error('❌ Errore durante l\'invio della notifica con template:', error);
      console.error('Dettagli errore:', (error as { response?: { data: unknown } })?.response?.data || error);
  
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
      console.log('🔄 [INVIO NOTIFICA] Rilevato template, reindirizzamento a handleSendNotificationWithTemplate');
      await handleSendNotificationWithTemplate();
      return;
    }
    
    try {
      console.log('🔄 [INVIO NOTIFICA SEMPLICE] Inizio processo di invio notifica semplice');
      console.log('📋 Dati notifica:', newNotification);
      
      setNotification({
        open: true,
        message: 'Invio in corso...',
        severity: 'info'
      });

      // Ottieni il numero di telefono dell'utente
      console.log(`🔍 Recupero numero di telefono per l'utente ID: ${newNotification.patient_id}`);
      const userResponse = await axios.get(`http://localhost:3001/api/users/${newNotification.patient_id}`);
      console.log('✅ Risposta API utente:', userResponse.data);
      const phoneNumber = userResponse.data.phone;
      
      if (!phoneNumber) {
        console.error('❌ Utente senza numero di telefono');
        setNotification({
          open: true,
          message: 'L\'utente selezionato non ha un numero di telefono',
          severity: 'error'
        });
        return;
      }
      console.log(`📱 Numero di telefono trovato: ${phoneNumber}`);

      // Salva la notifica nel database
      console.log('💾 Salvataggio notifica nel database...');
      console.log('📤 Payload richiesta:', newNotification);
      const response = await axios.post('http://localhost:3001/api/notifications', newNotification);
      console.log('📥 Risposta salvataggio notifica:', response.data);

      // Invia la notifica tramite WhatsApp
      console.log('📲 Invio notifica WhatsApp...');
      console.log('📝 Messaggio:', newNotification.message);
      await notificationService.sendWhatsAppNotification(phoneNumber, newNotification.message);
      console.log('✅ Notifica WhatsApp inviata con successo');
      
      // Aggiorna lo stato della notifica nel database
      if (response.data && response.data.id) {
        console.log(`🔄 Aggiornamento stato notifica ID: ${response.data.id}`);
        await axios.post(`http://localhost:3001/api/notifications/process/${response.data.id}`);
        console.log('✅ Stato notifica aggiornato con successo');
      }

      console.log('✅ Processo di invio notifica completato con successo');
      setNotification({
        open: true,
        message: 'Notifica inviata con successo',
        severity: 'success'
      });

      handleCloseSendDialog();

      fetchNotifications();
    } catch (error) {
      console.error('❌ Errore durante l\'invio della notifica:', error);
      console.error('Dettagli errore:', (error as { response?: { data: unknown } })?.response?.data || error);
  
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
          
          {/* Filtro per tipo rimosso */}
          
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Utente</InputLabel>
            <Select
              value={filters.userId}
              label="Utente"
              onChange={(e) => handleFilterChange('userId', e.target.value)}
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
              setFilters({ status: '', userId: '' }),
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
            {/* Barra degli strumenti per la selezione multipla */}
            {notifications.length > 0 && (
              <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectMode}
                      onChange={toggleSelectMode}
                      color="primary"
                    />
                  }
                  label="Modalità selezione"
                />
                
                {selectMode && (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleSelectAll}
                    >
                      {selectedNotifications.length === notifications.length ? 'Deseleziona tutti' : 'Seleziona tutti'}
                    </Button>
                    
                    {selectedNotifications.length > 0 && (
                      <>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<SendIcon />}
                          onClick={handleProcessPendingNotifications}
                          color="primary"
                        >
                          Invia selezionate ({selectedNotifications.length})
                        </Button>
                        
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={handleDeleteSelectedNotifications}
                          color="error"
                        >
                          Elimina selezionate ({selectedNotifications.length})
                        </Button>
                      </>
                    )}
                  </>
                )}
              </Box>
            )}
            
            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    {selectMode && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedNotifications.length === notifications.length && notifications.length > 0}
                          indeterminate={selectedNotifications.length > 0 && selectedNotifications.length < notifications.length}
                          onChange={handleSelectAll}
                        />
                      </TableCell>
                    )}
                    <TableCell>Stato</TableCell>
                    <TableCell>Utente</TableCell>
                    <TableCell>Messaggio</TableCell>
                    <TableCell>Data creazione</TableCell>
                    <TableCell>Data invio</TableCell>
                    <TableCell>Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {notifications?.map((notification) => (
                    <TableRow 
                      key={notification.id}
                      selected={selectMode && isNotificationSelected(notification.id)}
                      onClick={selectMode ? () => handleSelectNotification(notification.id) : undefined}
                      sx={selectMode ? { cursor: 'pointer' } : undefined}
                    >
                      {selectMode && (
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={isNotificationSelected(notification.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleSelectNotification(notification.id);
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                      )}
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
                      <TableCell>
                        {notification.first_name && notification.last_name 
                          ? `${notification.first_name} ${notification.last_name}` 
                          : notification.patient_name || '-'}
                      </TableCell>
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
                      <TableCell>{notification.status === 'sent' ? formatDate(notification.sent_at) : '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex' }}>
                          {notification.status === 'pending' && (
                            <Tooltip title="Invia">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleProcessSingleNotification(notification.id);
                                }}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResendNotification(notification.id);
                                }}
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
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenErrorDialog(notification);
                                }}
                              >
                                <ErrorIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          <Tooltip title="Elimina">
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDeleteDialog(notification);
                              }}
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
          {isSendDialogLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
            <FormControl fullWidth sx={{ mt: 2, mb: 2 }}>
              <InputLabel>Utente</InputLabel>
              <Select
                value={newNotification.patient_id}
                label="Utente"
                onChange={(e) => handleUserChange(e.target.value as string)}
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
                    onChange={handleTemplateChangeAdvanced}
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
                
                {/* Mostra la select per gli appuntamenti quando è selezionato un template e un utente */}
                {selectedTemplate && newNotification.patient_id && (
                  <FormControl
                    fullWidth
                    sx={{ mb: 2 }}
                    key={`appointment-select-${newNotification.patient_id}`} // Add key based on patient_id
                  >
                    <InputLabel>Seleziona Appuntamento</InputLabel>
                    <Select
                      value={templateVariables['appointment_id'] || ''}
                      label="Seleziona Appuntamento"
                      onChange={(e) => handleAppointmentSelect(e.target.value as string)}
                    >
                      <MenuItem value="">
                        <em>Seleziona un appuntamento</em>
                      </MenuItem>
                      {/* Utilizza filteredAppointments invece di appointments, aggiungendo un controllo Array.isArray */}
                      {Array.isArray(filteredAppointments) && filteredAppointments.map((appointment) => (
                        <MenuItem key={appointment.id} value={appointment.id.toString()}>
                          {appointment.title || 'Appuntamento'} - {new Date(appointment.appointment_date || appointment.date).toLocaleDateString('it-IT')} {appointment.appointment_time || appointment.time}
                        </MenuItem>
                      ))}
                    </Select>
                    <FormHelperText>
                      Seleziona un appuntamento per compilare automaticamente i campi relativi
                    </FormHelperText>
                  </FormControl>
                )}
                
                {/* Sezione Variabili del template rimossa */}
                
                {selectedTemplate && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid #e0e0e0' }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Anteprima del messaggio
                    </Typography>
                    {/* Non è più necessario il controllo ternario su clinicName qui, 
                        poiché il dialogo attende il caricamento */}
                    <Typography variant="body2">
                      {(() => {
                        const template = templates.find(t => t.id === selectedTemplate);
                        if (!template) return '';

                        const patient = patients.find(p => p.id.toString() === newNotification.patient_id);
                        const previewVariables: Record<string, string> = {
                          ...templateVariables,
                          clinic_name: clinicName, // Usa direttamente lo stato clinicName aggiornato
                          first_name: patient?.first_name || '',
                          last_name: patient?.last_name || '',
                          patient_name: patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : '',
                        };

                        // Log aggiunto per verificare clinicName prima dell'uso nell'anteprima
                        console.log('[Frontend] Using clinicName for preview (post-load):', clinicName);
                        
                        // Rimuovi le chiavi con valori vuoti se non devono sostituire nulla
                        Object.keys(previewVariables).forEach(key => {
                          if (previewVariables[key] === '') {
                            // Non eliminare, ma lascia che la replace gestisca il match non trovato
                          }
                        });

                        console.log('[Anteprima] Variabili per sostituzione:', previewVariables); // Log variabili anteprima
                        return notificationService.replaceTemplateVariables(template.content, previewVariables);
                      })()}
                    </Typography>
                    {/* Rimosso il blocco else che mostrava "Caricamento nome clinica..." */}
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
            </>
          )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseSendDialog}>Annulla</Button>
            <Button 
              onClick={handleSendNotification} 
              variant="contained" 
              color="primary" 
              disabled={isSendDialogLoading || (!useTemplate && !newNotification.message) || (useTemplate && !selectedTemplate) || !newNotification.patient_id}
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
