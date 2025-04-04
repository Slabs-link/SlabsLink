import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Dialog,
  InputAdornment,
  TextField,
  Snackbar,
  Alert,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Avatar,
  Divider,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Container,
  CircularProgress,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  FilterAlt as FilterIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  Cake as CakeIcon,
  LocationOn as LocationOnIcon,
  Badge as BadgeIcon,
  MedicalServices as MedicalServicesIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  Medication as MedicationIcon,
  Note as NoteIcon
} from '@mui/icons-material';
import axios from 'axios';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
// Import the User type from UserForm
import UserForm, { User } from './UserForm';
import Sidebar from '../common/Sidebar';
import UsersCard from './UsersCard';
import UserAppointments from './UserAppointments';
import UserFiles from './UserFiles';
import { styled } from '@mui/material/styles';

// Remove duplicate User type definition and use the imported one

// Add a type for creating/updating users that allows string dates
type UserInput = Omit<User, 'birth_date'> & {
  birth_date: Date | null | string;
};

// Add mock data for users
const MOCK_USERS: UserInput[] = [
  {
    id: 1,
    first_name: "Mario",
    last_name: "Rossi",
    email: "mario.rossi@example.com",
    phone: "3331234567",
    birth_date: "1980-01-15",
    gender: "Maschio",
    birth_city: "Roma",
    fiscal_code: "RSSMRA80A15H501X",
    address: "",
    city: "",
    postal_code: "",
    medical_history: "",
    allergies: "",
    medications: "",
    notes: "",
    consent_to_data_processing: false,
    consent_to_communications: false
  },
  {
    id: 2,
    first_name: "Giulia",
    last_name: "Bianchi",
    email: "giulia.bianchi@example.com",
    phone: "3387654321",
    birth_date: "1985-05-20",
    gender: "Femmina",
    birth_city: "Milano",
    fiscal_code: "BNCGLI85E60F205Y",
    address: "",
    city: "",
    postal_code: "",
    medical_history: "",
    allergies: "",
    medications: "",
    notes: "",
    consent_to_data_processing: false,
    consent_to_communications: false
  }
];

const API_BASE_URL = 'http://localhost:3001/api';

// Componenti styled per migliorare il layout
const SectionTitle = styled(Typography)(({ theme }) => ({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontWeight: 'bold',
  marginBottom: theme.spacing(2)
}));

const UsersList = styled(Box)(({ theme }) => ({
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

// Interface for TabPanel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// TabPanel component for the user details dialog
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`user-tabpanel-${index}`}
      aria-labelledby={`user-tab-${index}`}
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

// Mock appointments data
const MOCK_APPOINTMENTS = [
  {
    id: 1,
    date: '2023-06-15',
    time: '10:00',
    notes: 'Visita di controllo',
    status: 'completed'
  },
  {
    id: 2,
    date: '2023-07-20',
    time: '15:30',
    notes: 'Consulenza',
    status: 'upcoming'
  }
];

const Users = () => {
  // Initialize with mock data directly, but convert string dates to Date objects
  const [users, setUsers] = useState<User[]>(
    MOCK_USERS.map(user => ({
      ...user,
      birth_date: user.birth_date ? new Date(user.birth_date) : null
    }))
  );
  const [openDialog, setOpenDialog] = useState(false);
  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  // Add notification state
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  // State for the tab panel
  const [tabValue, setTabValue] = useState(0);
  // Stato per i filtri
  const [filters, setFilters] = useState({
    searchTerm: '',
    gender: 'all'
  });
  // Stato per il caricamento
  const [loading, setLoading] = useState(true);
  // Stato per le impostazioni dello studio medico
  const [officeSettings, setOfficeSettings] = useState({
    showInfoTab: true,
    enableUserFileUpload: false,
    userFilesPath: 'uploads/users'
  });

  // Carica le impostazioni dello studio medico
  const fetchOfficeSettings = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/settings/medical-office`);
      console.log('Impostazioni studio medico ricevute:', response.data);
      if (response.data) {
        const newSettings = {
          showInfoTab: response.data.showInfoTab !== undefined ? response.data.showInfoTab : true,
          enableUserFileUpload: response.data.enableUserFileUpload || false,
          userFilesPath: response.data.userFilesPath || 'uploads/users'
        };
        console.log('Impostazioni aggiornate:', newSettings);
        setOfficeSettings(newSettings);
      }
    } catch (error) {
      console.error('Errore nel caricamento delle impostazioni dello studio:', error);
      // Manteniamo i valori predefiniti in caso di errore
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchOfficeSettings();
  }, [fetchOfficeSettings]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/users`);
      if (response.data && Array.isArray(response.data)) {
        // Convert string dates to Date objects
        const formattedUsers = response.data.map((user: any) => ({
          ...user,
          birth_date: user.birth_date ? new Date(user.birth_date) : null
        }));
        setUsers(formattedUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      // We're already using mock data, so no need to set it again
      setNotification({
        open: true,
        message: 'Errore nel caricamento degli utenti',
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user?: User) => {
    setSelectedUser(user);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(undefined);
  };
  
  const handleOpenViewDialog = async (user: User) => {
    setSelectedUser(user);
    setOpenViewDialog(true);
    setTabValue(0); // Reset to first tab
  };
  
  const handleCloseViewDialog = () => {
    setOpenViewDialog(false);
    setSelectedUser(undefined);
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Effetto per gestire correttamente il tab quando cambiano le impostazioni o si apre il dialog
  useEffect(() => {
    if (selectedUser && openViewDialog) {
      // Quando si apre il dialog dei dettagli utente, imposta il tab a 0 (prima scheda disponibile)
      setTabValue(0);
    }
  }, [selectedUser, openViewDialog]);
  
  // Effetto per assicurarsi che il tab sia valido quando cambia showInfoTab
  useEffect(() => {
    // Se la scheda Informazioni viene disabilitata e siamo su quella scheda, passa alla prima scheda disponibile
    if (!officeSettings.showInfoTab && tabValue === 0) {
      setTabValue(0); // Mantieni il valore 0 ma ora rappresenta Storico Appuntamenti
    }
  }, [officeSettings.showInfoTab, tabValue]);


  // Calcola l'indice effettivo delle schede in base alle impostazioni
  const getTabIndex = (baseIndex: number) => {
    if (!officeSettings.showInfoTab && baseIndex > 0) {
      return baseIndex - 1;
    }
    return baseIndex;
  };
  
  // Calcola l'indice inverso delle schede (da visualizzato a reale)
  const getRealTabIndex = (displayIndex: number) => {
    if (!officeSettings.showInfoTab) {
      return displayIndex + 1;
    }
    return displayIndex;
  };

  const handleSaveUser = async (userData: Partial<User>) => {
    try {
      console.log('Dati completi inviati all\'API:', userData);
      
      // Verifica che birth_city e birth_city_code siano presenti
      if (!userData.birth_city) {
        console.warn('birth_city mancante nei dati utente');
      }
      if (!userData.birth_city_code) {
        console.warn('birth_city_code mancante nei dati utente');
      }
      
      if (userData.id) {
        // Update existing user
        await axios.put(`http://localhost:3001/api/users/${userData.id}`, userData);
      } else {
        // Create new user
        await axios.post('http://localhost:3001/api/users', userData);
      }
      
await fetchUsers(); // Call fetchUsers with await since it's an async function
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving user:', error);
      
      // Check if we should propagate the error to the form component
      if (error.response && error.response.status === 400) {
        // Propagate the error to the calling component
        throw error;
      }
      
      // For other errors or if we're in offline mode, simulate saving with mock data
      if (selectedUser && selectedUser.id !== undefined) {
        // Update existing user
        const updatedUsers = users.map(u => 
          u.id === selectedUser.id ? {...u, ...userData, id: selectedUser.id} : u
        );
        setUsers(updatedUsers);
        setNotification({
          open: true,
          message: 'Utente aggiornato con successo (modalità offline)',
          severity: 'success'
        });
      } else {
        // Add new user
        const newId = Math.max(...users.map(u => u.id || 0), 0) + 1;
        
        // Create a complete user object with default values for required fields
        const newUser: User = {
          id: newId,
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          gender: userData.gender || 'Maschio',
          birth_date: userData.birth_date || null,
          birth_city: userData.birth_city || '',
          phone: userData.phone || '',
          email: userData.email || '',
          address: userData.address || '',
          city: userData.city || '',
          postal_code: userData.postal_code || '',
          fiscal_code: userData.fiscal_code || '',
          medical_history: userData.medical_history || '',
          allergies: userData.allergies || '',
          medications: userData.medications || '',
          notes: userData.notes || '',
          consent_to_data_processing: userData.consent_to_data_processing || false,
          consent_to_communications: userData.consent_to_communications || false
        };
        
        setUsers([...users, newUser]);
        setNotification({
          open: true,
          message: 'Nuovo utente aggiunto con successo (modalità offline)',
          severity: 'success'
        });
      }
      handleCloseDialog();
    }
  };

  const handleDeleteUser = async (userId: number | undefined) => {
    if (!userId) return;
    
    if (window.confirm('Sei sicuro di voler eliminare questo utente?')) {
      try {
        await axios.delete(`${API_BASE_URL}/users/${userId}`);
        fetchUsers();
      } catch (error) {
        console.error('Error deleting user:', error);
        
        // Simulate deletion with mock data
        const updatedUsers = users.filter(u => u.id !== userId);
        setUsers(updatedUsers);
        setNotification({
          open: true,
          message: 'Utente eliminato con successo (modalità offline)',
          severity: 'success'
        });
      }
    }
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  // Funzione per applicare i filtri
  const applyFilters = () => {
    let result = [...users];
    
    // Filtra per termine di ricerca
    if (filters.searchTerm.trim() !== '') {
      const searchTerm = filters.searchTerm.toLowerCase().trim();
      result = result.filter(user => {
        return (
          user.first_name?.toLowerCase().includes(searchTerm) ||
          user.last_name?.toLowerCase().includes(searchTerm) ||
          user.email?.toLowerCase().includes(searchTerm) ||
          user.phone?.toLowerCase().includes(searchTerm) ||
          user.fiscal_code?.toLowerCase().includes(searchTerm)
        );
      });
    }
    
    // Filtra per genere
    if (filters.gender !== 'all') {
      result = result.filter(user => user.gender === filters.gender);
    }
    
    return result;
  };
  
  // Ottieni gli utenti filtrati
  const filteredUsers = applyFilters();
  
  // Gestione del cambio dei filtri
  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Funzione per resettare i filtri
  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      gender: 'all'
    });
  };

  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <SectionTitle variant="h4">Gestione Utenti</SectionTitle>
            
            <Button 
              variant="contained" 
              color="primary" 
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog(undefined)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Nuovo Utente
            </Button>
          </Box>
          
          {/* Filtri */}
          <FilterContainer>
            <TextField
              label="Cerca utenti"
              variant="outlined"
              size="small"
              value={filters.searchTerm}
              onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, minWidth: '200px' }}
            />
            
            <FormControl size="small" sx={{ minWidth: '150px' }}>
              <InputLabel id="gender-filter-label">Genere</InputLabel>
              <Select
                labelId="gender-filter-label"
                value={filters.gender}
                label="Genere"
                onChange={(e) => handleFilterChange('gender', e.target.value)}
              >
                <MenuItem value="all">Tutti</MenuItem>
                <MenuItem value="Maschio">Maschio</MenuItem>
                <MenuItem value="Femmina">Femmina</MenuItem>
                <MenuItem value="Altro">Altro</MenuItem>
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
          
          {/* Lista Utenti */}
          <UsersList>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : filteredUsers.length > 0 ? (
              <UsersCard 
                users={filteredUsers} 
                onView={handleOpenViewDialog} 
                onEdit={handleOpenDialog} 
                onDelete={handleDeleteUser} 
              />
            ) : (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  Nessun utente trovato
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Prova a modificare i filtri o crea un nuovo utente
                </Typography>
              </Box>
            )}
          </UsersList>
        </Container>
        
        {/* Edit User Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={handleCloseDialog}
          maxWidth="md"
          fullWidth
        >
          <UserForm 
            user={selectedUser} 
            onSave={handleSaveUser} 
            onCancel={handleCloseDialog} 
          />
        </Dialog>
        
        {/* View User Dialog */}
        <Dialog 
          open={openViewDialog} 
          onClose={handleCloseViewDialog}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h6" fontWeight="bold">Dettagli Utente</Typography>
          </DialogTitle>
          <DialogContent dividers>
            {selectedUser && (
              <Grid container spacing={3}>
                {/* Left column - User info */}
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: '#e8f5e9', 
                        color: '#4caf50', 
                        width: 100, 
                        height: 100, 
                        fontSize: '2rem',
                        mb: 2
                      }}
                    >
                      {selectedUser.first_name?.charAt(0)}{selectedUser.last_name?.charAt(0)}
                    </Avatar>
                    <Typography variant="h5" fontWeight="bold" align="center">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </Typography>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Informazioni Personali
                  </Typography>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <EmailIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="body1">{selectedUser.email}</Typography>
                  </Box>
                  
                  {selectedUser.phone && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PhoneIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body1">{selectedUser.phone}</Typography>
                    </Box>
                  )}
                  
                  {selectedUser.birth_date && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <CakeIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body1">
                        {format(new Date(selectedUser.birth_date), 'dd/MM/yyyy', { locale: it })}
                      </Typography>
                    </Box>
                  )}
                  
                  {selectedUser.gender && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body1">{selectedUser.gender}</Typography>
                    </Box>
                  )}
                  
                  {selectedUser.fiscal_code && (
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <BadgeIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="body1">{selectedUser.fiscal_code}</Typography>
                    </Box>
                  )}
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Indirizzo
                  </Typography>
                  
                  {(selectedUser.address || selectedUser.city || selectedUser.postal_code) && (
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                      <LocationOnIcon sx={{ mr: 1, color: 'primary.main', mt: 0.5 }} />
                      <Typography variant="body1">
                        {selectedUser.address}
                        {selectedUser.address && (selectedUser.city || selectedUser.postal_code) ? ', ' : ''}
                        {selectedUser.city}
                        {selectedUser.city && selectedUser.postal_code ? ' ' : ''}
                        {selectedUser.postal_code}
                      </Typography>
                    </Box>
                  )}
                </Grid>
                
                {/* Right column - Tabs */}
                <Grid item xs={12} md={8}>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="user details tabs">
                      {officeSettings.showInfoTab && (
                        <Tab label="Informazioni" id="user-tab-0" aria-controls="user-tabpanel-0" />
                      )}
                      <Tab 
                        label="Storico Appuntamenti" 
                        id={officeSettings.showInfoTab ? "user-tab-1" : "user-tab-0"}
                        aria-controls={officeSettings.showInfoTab ? "user-tabpanel-1" : "user-tabpanel-0"}
                      />
                      <Tab 
                        label="Documenti" 
                        id={officeSettings.showInfoTab ? "user-tab-2" : "user-tab-1"}
                        aria-controls={officeSettings.showInfoTab ? "user-tabpanel-2" : "user-tabpanel-1"}
                      />
                    </Tabs>
                  </Box>
                  
                  {/* Medical Information Tab */}
                  {officeSettings.showInfoTab && (
                    <TabPanel value={tabValue} index={0}>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            <MedicalServicesIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                            Storia Medica
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                            <Typography variant="body1">
                              {selectedUser.medical_history || 'Nessuna informazione disponibile'}
                            </Typography>
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            <HealthAndSafetyIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                            Allergie
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                            <Typography variant="body1">
                              {selectedUser.allergies || 'Nessuna allergia registrata'}
                            </Typography>
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            <MedicationIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                            Farmaci
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                            <Typography variant="body1">
                              {selectedUser.medications || 'Nessun farmaco registrato'}
                            </Typography>
                          </Paper>
                        </Grid>
                        
                        <Grid item xs={12}>
                          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                            <NoteIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                            Note
                          </Typography>
                          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                            <Typography variant="body1">
                              {selectedUser.notes || 'Nessuna nota disponibile'}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>
                    </TabPanel>
                  )}
                  
                  {/* Appointments Tab */}
                  <TabPanel value={tabValue} index={officeSettings.showInfoTab ? 1 : 0}>
                    {selectedUser && selectedUser.id && (
                      <UserAppointments userId={selectedUser.id} />
                    )}
                  </TabPanel>
                  
                  {/* Documents Tab */}
                  <TabPanel value={tabValue} index={officeSettings.showInfoTab ? 2 : 1}>
                    {selectedUser && selectedUser.id && (
                      <UserFiles userId={selectedUser.id} />
                    )}
                  </TabPanel>
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseViewDialog} color="primary">
              Chiudi
            </Button>
          </DialogActions>
        </Dialog>

        {/* Il dialog per i dettagli degli appuntamenti è stato rimosso */}
        
        {/* Add notification component */}
        <Snackbar 
          open={notification.open} 
          autoHideDuration={6000} 
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity as any}
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
  );
};

export default Users;