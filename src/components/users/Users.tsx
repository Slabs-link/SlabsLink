import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Dialog,
  IconButton,
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
  MenuItem
} from '@mui/material';
import { 
  Add as AddIcon, 
  Search as SearchIcon, 
  Edit as EditIcon, 
  Delete as DeleteIcon, 
  Visibility as VisibilityIcon,
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
  // Rimosso stato per gli appuntamenti utente

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
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
      
      fetchUsers();
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

  const filteredUsers = users.filter(user => 
    user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4">Utenti</Typography>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog(undefined)}
          >
            AGGIUNGI UTENTE
          </Button>
        </Box>
        
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Cerca utenti..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </Box>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nome</TableCell>
                <TableCell>Cognome</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Telefono</TableCell>
                <TableCell>Data di Nascita</TableCell>
                <TableCell>Azioni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.first_name}</TableCell>
                  <TableCell>{user.last_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    {user.birth_date ? format(new Date(user.birth_date), 'dd/MM/yyyy', { locale: it }) : ''}
                  </TableCell>
                  <TableCell>
                    <IconButton onClick={() => handleOpenViewDialog(user)} color="info" title="Visualizza">
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton onClick={() => handleOpenDialog(user)} color="primary" title="Modifica">
                      <EditIcon />
                    </IconButton>
                    <IconButton onClick={() => handleDeleteUser(user.id)} color="error" title="Elimina">
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
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
                      <Tab label="Informazioni" id="user-tab-0" aria-controls="user-tabpanel-0" />
                    </Tabs>
                  </Box>
                  
                  {/* Medical Information Tab */}
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
                  
                  {/* La scheda Appuntamenti è stata rimossa */}
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