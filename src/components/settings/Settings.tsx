import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Box, Typography, Container, Paper, Tabs, Tab, Button, TextField, Switch, FormControlLabel, Divider, Grid, Alert, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import Sidebar from '../common/Sidebar';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

interface AppointmentType {
  id: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [licenseFeatures, setLicenseFeatures] = useState({
    whatsappIntegration: false,
    googleCalendarIntegration: false
  });
  
  // License state
  const [licenseInfo, setLicenseInfo] = useState({
    key: '',
    expirationDate: '',
    daysUntilExpiry: 0,
    isValid: false
  });
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [uploadedLicenseFile, setUploadedLicenseFile] = useState<File | null>(null);
  const [licenseUpdateSuccess, setLicenseUpdateSuccess] = useState(false);
  const [licenseUpdateError, setLicenseUpdateError] = useState<string | null>(null);
  
  // API base URL
  const API_BASE_URL = 'http://localhost:3001/api';
  
  // WhatsApp settings state
  const [whatsappSettings, setWhatsappSettings] = useState({
    enabled: false,
    browserPath: '',
    dataPath: '',
    autoReply: false,
    autoReplyMessage: ''
  });
  
  // Google Calendar settings state
  const [calendarSettings, setCalendarSettings] = useState({
    googleCalendarEnabled: false,
    clientId: '',
    clientSecret: '',
    redirectUri: 'http://localhost:3000/auth/google/callback',
    workingHours: {
      mondayStart: '09:00',
      mondayEnd: '18:00',
      tuesdayStart: '09:00',
      tuesdayEnd: '18:00',
      wednesdayStart: '09:00',
      wednesdayEnd: '18:00',
      thursdayStart: '09:00',
      thursdayEnd: '18:00',
      fridayStart: '09:00',
      fridayEnd: '18:00',
      saturdayStart: '',
      saturdayEnd: '',
      sundayStart: '',
      sundayEnd: ''
    }
  });
  
  // Appointment Types state
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingAppointmentType, setEditingAppointmentType] = useState<AppointmentType | null>(null);
  const [newAppointmentType, setNewAppointmentType] = useState({
    name: '',
    description: ''
  });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentTypeToDelete, setAppointmentTypeToDelete] = useState<number | null>(null);
  
  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    clinicName: '',
    address: '',
    phone: '',
    email: '',
    website: ''
  });
  
  // Notification settings state
  const [notificationSettings, setNotificationSettings] = useState({
    appointmentReminders: false,
    reminderTime: 24,
    reminderMessage: 'Promemoria: hai un appuntamento domani alle {time}.',
    followUpMessages: false,
    followUpTime: 24,
    followUpMessage: 'Grazie per la tua visita. Come ti senti dopo l\'appuntamento?'
  });
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  const handleWhatsappSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setWhatsappSettings({
      ...whatsappSettings,
      [e.target.name]: value
    });
  };
  
  const handleCalendarSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    const name = e.target.name;
    
    if (name.startsWith('workingHours.')) {
      const hourField = name.split('.')[1];
      setCalendarSettings({
        ...calendarSettings,
        workingHours: {
          ...calendarSettings.workingHours,
          [hourField]: value
        }
      });
    } else {
      setCalendarSettings({
        ...calendarSettings,
        [name]: value
      });
    }
  };
  
  const handleGeneralSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setGeneralSettings({
      ...generalSettings,
      [e.target.name]: value
    });
  };
  
  const handleNotificationSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setNotificationSettings({
      ...notificationSettings,
      [e.target.name]: value
    });
  };
  
  const handleNewAppointmentTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewAppointmentType({
      ...newAppointmentType,
      [e.target.name]: e.target.value
    });
  };
  
  const handleAddAppointmentType = async () => {
    if (!newAppointmentType.name) {
      setSaveError(true);
      setTimeout(() => {
        setSaveError(false);
      }, 3000);
      return;
    }
    
    try {
      const response = await axios.post(`${API_BASE_URL}/appointment-types`, newAppointmentType);
      setAppointmentTypes([...appointmentTypes, response.data]);
      setNewAppointmentType({ name: '', description: '' });
      setOpenDialog(false);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Errore durante l\'aggiunta del tipo di appuntamento:', error);
      setSaveError(true);
      setTimeout(() => {
        setSaveError(false);
      }, 3000);
    }
  };
  
  const handleEditAppointmentType = (appointmentType: AppointmentType) => {
    setEditingAppointmentType(appointmentType);
    setNewAppointmentType({
      name: appointmentType.name,
      description: appointmentType.description || ''
    });
    setOpenDialog(true);
  };
  
  const handleUpdateAppointmentType = async () => {
    if (!editingAppointmentType || !newAppointmentType.name) {
      setSaveError(true);
      setTimeout(() => {
        setSaveError(false);
      }, 3000);
      return;
    }
    
    try {
      const response = await axios.put(`${API_BASE_URL}/appointment-types/${editingAppointmentType.id}`, newAppointmentType);
      setAppointmentTypes(appointmentTypes.map(type => 
        type.id === editingAppointmentType.id ? response.data : type
      ));
      setNewAppointmentType({ name: '', description: '' });
      setEditingAppointmentType(null);
      setOpenDialog(false);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Errore durante l\'aggiornamento del tipo di appuntamento:', error);
      setSaveError(true);
      setTimeout(() => {
        setSaveError(false);
      }, 3000);
    }
  };
  
  const handleDeleteConfirm = (id: number) => {
    setAppointmentTypeToDelete(id);
    setDeleteConfirmOpen(true);
  };
  
  const handleDeleteAppointmentType = async () => {
    if (!appointmentTypeToDelete) return;
    
    try {
      await axios.delete(`${API_BASE_URL}/appointment-types/${appointmentTypeToDelete}`);
      setAppointmentTypes(appointmentTypes.filter(type => type.id !== appointmentTypeToDelete));
      setDeleteConfirmOpen(false);
      setAppointmentTypeToDelete(null);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Errore durante l\'eliminazione del tipo di appuntamento:', error);
      setSaveError(true);
      setTimeout(() => {
        setSaveError(false);
      }, 3000);
    }
  };
  
  // Calcola l'indice della scheda dei tipi di appuntamento in base alle licenze attive
  const getAppointmentTypesTabIndex = () => {
    let index = 1; // Licenza è sempre l'indice 0
    if (licenseFeatures.whatsappIntegration) index++;
    return index;
  };
  
  // Handle license key change
  const handleLicenseKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewLicenseKey(e.target.value);
  };
  
  // Handle license file upload
  const handleLicenseFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadedLicenseFile(e.target.files[0]);
      setLicenseUpdateError(null);
    }
  };
  
  // Update license with key
  const handleUpdateLicenseWithKey = async () => {
    if (!newLicenseKey) {
      setLicenseUpdateError('Inserisci una chiave di licenza valida');
      return;
    }
    
    try {
      const response = await axios.post(`${API_BASE_URL}/license/update`, { licenseKey: newLicenseKey });
      
      if (response.data.success) {
        setLicenseUpdateSuccess(true);
        setLicenseUpdateError(null);
        setNewLicenseKey('');
        
        // Refresh license info
        fetchLicenseInfo();
        
        setTimeout(() => {
          setLicenseUpdateSuccess(false);
        }, 3000);
      } else {
        setLicenseUpdateError(response.data.message || 'Errore durante l\'aggiornamento della licenza');
      }
    } catch (error: any) {
      console.error('Errore durante l\'aggiornamento della licenza:', error);
      setLicenseUpdateError(error.response?.data?.message || 'Errore durante l\'aggiornamento della licenza');
    }
  };
  
  // Update license with file
  const handleUpdateLicenseWithFile = async () => {
    if (!uploadedLicenseFile) {
      setLicenseUpdateError('Seleziona un file di licenza valido');
      return;
    }
    
    try {
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const licenseData = JSON.parse(content);
          
          if (!licenseData.key || !licenseData.expirationDate || !licenseData.features) {
            setLicenseUpdateError('Il file di licenza non è valido. Mancano campi obbligatori.');
            return;
          }
          
          const response = await axios.post(`${API_BASE_URL}/license/update`, { 
            licenseKey: licenseData.key,
            expirationDate: licenseData.expirationDate,
            features: licenseData.features
          });
          
          if (response.data.success) {
            setLicenseUpdateSuccess(true);
            setLicenseUpdateError(null);
            setUploadedLicenseFile(null);
            
            // Refresh license info
            fetchLicenseInfo();
            
            setTimeout(() => {
              setLicenseUpdateSuccess(false);
            }, 3000);
          } else {
            setLicenseUpdateError(response.data.message || 'Errore durante l\'aggiornamento della licenza');
          }
        } catch (error) {
          console.error('Errore durante la lettura del file di licenza:', error);
          setLicenseUpdateError('Il file selezionato non è un file JSON valido.');
        }
      };
      
      fileReader.onerror = () => {
        setLicenseUpdateError('Errore durante la lettura del file.');
      };
      
      fileReader.readAsText(uploadedLicenseFile);
    } catch (error: any) {
      console.error('Errore durante l\'aggiornamento della licenza:', error);
      setLicenseUpdateError(error.response?.data?.message || 'Errore durante l\'aggiornamento della licenza');
    }
  };
  
  // Fetch license information
  const fetchLicenseInfo = async () => {
    try {
      const licenseResponse = await axios.get(`${API_BASE_URL}/license`);
      if (licenseResponse.data) {
        setLicenseInfo({
          key: licenseResponse.data.key || '',
          expirationDate: licenseResponse.data.expirationDate || '',
          daysUntilExpiry: licenseResponse.data.daysUntilExpiry || 0,
          isValid: licenseResponse.data.isValid || false
        });
        
        if (licenseResponse.data.features) {
          setLicenseFeatures({
            whatsappIntegration: licenseResponse.data.features.whatsappIntegration || false,
            googleCalendarIntegration: licenseResponse.data.features.googleCalendarIntegration || false
          });
        }
      }
    } catch (error) {
      console.error('Errore durante il recupero delle informazioni sulla licenza:', error);
    }
  };
  
  // Carica le impostazioni dal server
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        // Carica le informazioni sulla licenza
        await fetchLicenseInfo();
        
        // Carica le impostazioni WhatsApp
        const whatsappResponse = await axios.get(`${API_BASE_URL}/settings/whatsapp`);
        if (whatsappResponse.data && whatsappResponse.data.whatsapp) {
          setWhatsappSettings(whatsappResponse.data.whatsapp);
        }
        
        // Carica le impostazioni del calendario
        const calendarResponse = await axios.get(`${API_BASE_URL}/settings/calendar`);
        if (calendarResponse.data && calendarResponse.data.calendar) {
          setCalendarSettings(calendarResponse.data.calendar);
        }
        
        // Carica i tipi di appuntamento dalla tabella appointment_types
        const appointmentTypesResponse = await axios.get(`${API_BASE_URL}/appointment-types`);
        if (appointmentTypesResponse.data) {
          setAppointmentTypes(appointmentTypesResponse.data);
        }
      } catch (error) {
        console.error('Errore durante il caricamento delle impostazioni:', error);
        // Se le impostazioni non esistono, utilizziamo i valori predefiniti
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  const handleSaveSettings = async () => {
    try {
      // Salva le impostazioni WhatsApp
      if (licenseFeatures.whatsappIntegration) {
        await axios.put(`${API_BASE_URL}/settings/whatsapp`, whatsappSettings);
      }
      
      // Salva le impostazioni del calendario
      if (licenseFeatures.googleCalendarIntegration) {
        await axios.put(`${API_BASE_URL}/settings/calendar`, calendarSettings);
      }
      
      // Mostra il messaggio di successo WhatsApp
      await axios.put(`${API_BASE_URL}/settings/whatsapp`, whatsappSettings);
      
      // Salva le impostazioni del calendario
      await axios.put(`${API_BASE_URL}/settings/calendar`, calendarSettings);
      
      // Salva le impostazioni delle notifiche
      await axios.put(`${API_BASE_URL}/settings/notifications`, notificationSettings);
      
      // Mostra il messaggio di successo
      setSaveSuccess(true);
      setSaveError(false);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Errore durante il salvataggio delle impostazioni:', error);
      setSaveError(true);
      setTimeout(() => {
        setSaveError(false);
      }, 3000);
    }
  };
  
  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant="h4" fontWeight="bold">Impostazioni</Typography>
            
            <Button 
              variant="contained" 
              startIcon={<SaveIcon />}
              color="primary"
              onClick={handleSaveSettings}
            >
              Salva Impostazioni
            </Button>
          </Box>
          
          {isLoading ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              Caricamento impostazioni in corso...
            </Alert>
          ) : (
            <>
              {saveSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Impostazioni salvate con successo!
                </Alert>
              )}
              {saveError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  Errore durante il salvataggio delle impostazioni. Riprova più tardi.
                </Alert>
              )}
            </>
          )}
          
          <Paper sx={{ mb: 4, borderRadius: '8px' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
                <Tab label="Licenza" />
                {licenseFeatures.whatsappIntegration && <Tab label="WhatsApp" />}
                {licenseFeatures.googleCalendarIntegration && <Tab label="Google Calendar" />}
                <Tab label="Tipi di appuntamento" />
              </Tabs>
            </Box>
            
            {/* License Settings */}
            <TabPanel value={tabValue} index={0}>
              <Typography variant="h6" gutterBottom>Informazioni Licenza</Typography>
              
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Stato Licenza</Typography>
                    
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body1">
                        <strong>Chiave:</strong> {licenseInfo.key || 'N/A'}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Data di scadenza:</strong> {licenseInfo.expirationDate || 'N/A'}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Giorni alla scadenza:</strong> {licenseInfo.daysUntilExpiry}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Stato:</strong> {licenseInfo.isValid ? (
                          <span style={{ color: 'green' }}>Valida</span>
                        ) : (
                          <span style={{ color: 'red' }}>Scaduta o non valida</span>
                        )}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Funzionalità Abilitate</Typography>
                    
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body1">
                        <strong>Integrazione WhatsApp:</strong> {licenseFeatures.whatsappIntegration ? (
                          <span style={{ color: 'green' }}>Abilitata</span>
                        ) : (
                          <span style={{ color: 'red' }}>Non abilitata</span>
                        )}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Integrazione Google Calendar:</strong> {licenseFeatures.googleCalendarIntegration ? (
                          <span style={{ color: 'green' }}>Abilitata</span>
                        ) : (
                          <span style={{ color: 'red' }}>Non abilitata</span>
                        )}
                      </Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
              
              <Divider sx={{ my: 4 }} />
              
              <Typography variant="h6" gutterBottom>Aggiorna Licenza</Typography>
              
              {licenseUpdateSuccess && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  Licenza aggiornata con successo!
                </Alert>
              )}
              
              {licenseUpdateError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {licenseUpdateError}
                </Alert>
              )}
              
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <Paper sx={{ p: 2 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Aggiorna con File</Typography>
                    
                    <Button
                      variant="outlined"
                      component="label"
                      fullWidth
                      sx={{ mt: 2, mb: 2, py: 1.5 }}
                    >
                      Seleziona File di Licenza
                      <input
                        type="file"
                        accept=".json"
                        hidden
                        onChange={handleLicenseFileUpload}
                      />
                    </Button>
                    
                    {uploadedLicenseFile && (
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        File selezionato: {uploadedLicenseFile.name}
                      </Typography>
                    )}
                    
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleUpdateLicenseWithFile}
                      disabled={!uploadedLicenseFile}
                    >
                      Carica e Aggiorna
                    </Button>
                  </Paper>
                </Grid>
              </Grid>
            </TabPanel>
            
            {/* WhatsApp Settings - Visible only if license allows */}
            {licenseFeatures.whatsappIntegration && (
              <TabPanel value={tabValue} index={1}>
                <Typography variant="h6" gutterBottom>Configurazione WhatsApp</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={whatsappSettings.enabled}
                      onChange={handleWhatsappSettingsChange}
                      name="enabled"
                    />
                  }
                  label="Abilita integrazione WhatsApp"
                  sx={{ mb: 2 }}
                />
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Percorso Browser Chrome"
                      name="browserPath"
                      value={whatsappSettings.browserPath}
                      onChange={handleWhatsappSettingsChange}
                      margin="normal"
                      disabled={!whatsappSettings.enabled}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Percorso Dati WhatsApp"
                      name="dataPath"
                      value={whatsappSettings.dataPath}
                      onChange={handleWhatsappSettingsChange}
                      margin="normal"
                      disabled={!whatsappSettings.enabled}
                    />
                  </Grid>
                </Grid>
              </TabPanel>
            )}
            
            {/* Google Calendar Settings - Visible only if license allows */}
            {licenseFeatures.googleCalendarIntegration && (
              <TabPanel value={tabValue} index={licenseFeatures.whatsappIntegration ? 2 : 1}>
                <Typography variant="h6" gutterBottom>Integrazione Google Calendar</Typography>
                
                <Alert severity="info" sx={{ mb: 3 }}>
                  L'integrazione con Google Calendar permette di sincronizzare gli appuntamenti tra SlabsLink e il tuo calendario Google.
                </Alert>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={calendarSettings.googleCalendarEnabled}
                      onChange={handleCalendarSettingsChange}
                      name="googleCalendarEnabled"
                    />
                  }
                  label="Abilita integrazione Google Calendar"
                  sx={{ mb: 2 }}
                />
                
                <Paper sx={{ p: 3, mb: 4, bgcolor: '#f9f9f9' }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Guida alla configurazione di Google Calendar
                  </Typography>
                  
                  <Typography variant="body1" paragraph>
                    Per configurare l'integrazione con Google Calendar, segui questi passaggi:
                  </Typography>
                  
                  <div>
                    <ol>
                      <li>
                        <strong>Crea un progetto nella Google Cloud Console:</strong>
                        <ul>
                          <li>Vai alla <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer">Google Cloud Console</a></li>
                          <li>Crea un nuovo progetto o seleziona un progetto esistente</li>
                          <li>Prendi nota del nome del progetto</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Abilita l'API Google Calendar:</strong>
                        <ul>
                          <li>Nel menu laterale, vai su "API e servizi" - "Libreria"</li>
                          <li>Cerca "Google Calendar API" e selezionala</li>
                          <li>Clicca su "Abilita"</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Configura la schermata di consenso OAuth:</strong>
                        <ul>
                          <li>Nel menu laterale, vai su "API e servizi" - "Schermata di consenso OAuth"</li>
                          <li>Seleziona "Esterno" come tipo di utente e clicca su "Crea"</li>
                          <li>Compila i campi obbligatori (nome app, email di supporto, ecc.)</li>
                          <li>Aggiungi il dominio della tua applicazione nei "Domini autorizzati"</li>
                          <li>Clicca su "Salva e continua"</li>
                          <li>Nella sezione "Ambiti", aggiungi gli ambiti necessari per Google Calendar (ad es. "./auth/calendar" e "./auth/calendar.events")</li>
                          <li>Completa la configurazione e torna alla dashboard</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Crea le credenziali OAuth 2.0:</strong>
                        <ul>
                          <li>Nel menu laterale, vai su "API e servizi" - "Credenziali"</li>
                          <li>Clicca su "Crea credenziali" e seleziona "ID client OAuth"</li>
                          <li>Seleziona "Applicazione Web" come tipo di applicazione</li>
                          <li>Assegna un nome all'applicazione</li>
                          <li>Aggiungi l'URI di reindirizzamento: <code>{calendarSettings.redirectUri}</code></li>
                          <li>Clicca su "Crea"</li>
                          <li>Copia il "Client ID" e il "Client Secret" generati e inseriscili nei campi sottostanti</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Configura SlabsLink:</strong>
                        <ul>
                          <li>Inserisci il Client ID e il Client Secret nei campi sottostanti</li>
                          <li>Verifica che l'URI di reindirizzamento corrisponda a quello configurato in Google Cloud Console</li>
                          <li>Salva le impostazioni</li>
                        </ul>
                      </li>
                      <li>
                        <strong>Autorizza l'applicazione:</strong>
                        <ul>
                          <li>Dopo aver salvato le impostazioni, riavvia l'applicazione</li>
                          <li>Vai alla pagina degli appuntamenti</li>
                          <li>Clicca sul pulsante "Autorizza Google Calendar"</li>
                          <li>Segui le istruzioni per autorizzare l'accesso al tuo calendario Google</li>
                        </ul>
                      </li>
                    </ol>
                  </div>
                  
                  <Typography variant="body1" paragraph sx={{ mt: 2 }}>
                    <strong>Nota:</strong> Se stai utilizzando SlabsLink in ambiente di sviluppo (localhost), assicurati di aggiungere anche <code>http://localhost:3000/auth/google/callback</code> come URI di reindirizzamento autorizzato nelle credenziali OAuth 2.0.
                  </Typography>
                </Paper>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Client ID"
                      name="clientId"
                      value={calendarSettings.clientId}
                      onChange={handleCalendarSettingsChange}
                      margin="normal"
                      disabled={!calendarSettings.googleCalendarEnabled}
                      helperText="L'ID client OAuth 2.0 generato nella Google Cloud Console"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Client Secret"
                      name="clientSecret"
                      value={calendarSettings.clientSecret}
                      onChange={handleCalendarSettingsChange}
                      margin="normal"
                      type="password"
                      disabled={!calendarSettings.googleCalendarEnabled}
                      helperText="Il secret client OAuth 2.0 generato nella Google Cloud Console"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Redirect URI"
                      name="redirectUri"
                      value={calendarSettings.redirectUri}
                      onChange={handleCalendarSettingsChange}
                      margin="normal"
                      disabled={!calendarSettings.googleCalendarEnabled}
                      helperText="L'URI di reindirizzamento deve corrispondere a quello configurato in Google Cloud Console"
                    />
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary" paragraph>
                    Dopo aver configurato le credenziali e salvato le impostazioni, è necessario autorizzare l'applicazione ad accedere al tuo calendario Google cliccando sul pulsante qui sotto.
                  </Typography>
                  
                  <Button 
                    variant="contained" 
                    color="primary"
                    disabled={!calendarSettings.googleCalendarEnabled || !calendarSettings.clientId || !calendarSettings.clientSecret}
                    onClick={() => {
                      window.location.href = `${API_BASE_URL}/google-calendar/auth?clientId=${calendarSettings.clientId}&clientSecret=${calendarSettings.clientSecret}&redirectUri=${calendarSettings.redirectUri}`;
                    }}
                    sx={{ mt: 1 }}
                  >
                    Autorizza Google Calendar
                  </Button>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    <strong>Nota:</strong> Se dopo aver cliccato sul pulsante non viene visualizzata la pagina di autorizzazione di Google, verifica che:
                    <ul>
                      <li>Le credenziali Client ID e Client Secret siano corrette</li>
                      <li>L'URI di reindirizzamento sia configurato correttamente nella console Google Cloud</li>
                      <li>Il server sia in esecuzione e raggiungibile</li>
                    </ul>
                  </Typography>
                </Box>
              </TabPanel>
            )}
            
            {/* Appointment Types Settings */}
            <TabPanel value={tabValue} index={getAppointmentTypesTabIndex() + 1}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Tipi di appuntamento</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setEditingAppointmentType(null);
                    setNewAppointmentType({ name: '', description: '' });
                    setOpenDialog(true);
                  }}
                >
                  Aggiungi nuovo
                </Button>
              </Box>
              
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nome</TableCell>
                      <TableCell>Descrizione</TableCell>
                      <TableCell align="right">Azioni</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {appointmentTypes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} align="center">Nessun tipo di appuntamento trovato</TableCell>
                      </TableRow>
                    ) : (
                      appointmentTypes.map((type) => (
                        <TableRow key={type.id}>
                          <TableCell>{type.name}</TableCell>
                          <TableCell>{type.description || '-'}</TableCell>
                          <TableCell align="right">
                            <IconButton
                              color="primary"
                              onClick={() => handleEditAppointmentType(type)}
                              size="small"
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              color="error"
                              onClick={() => handleDeleteConfirm(type.id)}
                              size="small"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </TabPanel>
            

            
            {/* Placeholder for future settings */}
            
            {/* Placeholder for future settings */}
          </Paper>
        </Container>
      </Box>
      
      {/* Dialog per aggiungere/modificare un tipo di appuntamento */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingAppointmentType ? 'Modifica tipo di appuntamento' : 'Aggiungi nuovo tipo di appuntamento'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            name="name"
            label="Nome"
            type="text"
            fullWidth
            value={newAppointmentType.name}
            onChange={handleNewAppointmentTypeChange}
            required
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            margin="dense"
            name="description"
            label="Descrizione"
            type="text"
            fullWidth
            value={newAppointmentType.description}
            onChange={handleNewAppointmentTypeChange}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Annulla</Button>
          <Button 
            onClick={editingAppointmentType ? handleUpdateAppointmentType : handleAddAppointmentType}
            variant="contained"
          >
            {editingAppointmentType ? 'Aggiorna' : 'Aggiungi'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog di conferma eliminazione */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Conferma eliminazione</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler eliminare questo tipo di appuntamento? Questa azione non può essere annullata.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Annulla</Button>
          <Button onClick={handleDeleteAppointmentType} color="error" variant="contained">
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
