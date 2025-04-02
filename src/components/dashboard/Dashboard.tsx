import React, { useState, useEffect } from 'react';
import { Box, Typography, Container, Grid, Paper, Avatar, Button, Card, CardContent, Badge, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Divider, TextField, Tabs, Tab, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, FormControl, InputLabel, Select, MenuItem, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import PeopleIcon from '@mui/icons-material/People';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import TodayIcon from '@mui/icons-material/Today';
import Sidebar from '../common/Sidebar';
import axios from 'axios';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDate } from 'date-fns';
import { it } from 'date-fns/locale';
import { formatDate } from '../../utils';

import HomeIcon from '@mui/icons-material/Home';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import CakeIcon from '@mui/icons-material/Cake';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import VisibilityIcon from '@mui/icons-material/Visibility';
import NoteIcon from '@mui/icons-material/Note';
import AccessTime from '@mui/icons-material/AccessTime';

// Styled components
const SidebarContainer = styled(Box)(({ theme }) => ({
  backgroundColor: '#f8f9fa',
  height: '100vh',
  padding: theme.spacing(2),
  borderRight: '1px solid #e0e0e0',
  display: 'flex',
  flexDirection: 'column'
}));

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

const ContentCard = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: theme.shape.borderRadius,
  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column'
}));

const AppointmentItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(2),
  borderBottom: '1px solid #f0f0f0',
  '&:last-child': {
    borderBottom: 'none'
  }
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontWeight: 'bold',
  marginBottom: theme.spacing(2)
}));

const AppointmentsList = styled(Box)(({ theme }) => ({
  overflowY: 'auto',
  maxHeight: '300px',
  flex: 1
}));

const PatientsList = styled(Box)(({ theme }) => ({
  overflowY: 'auto',
  maxHeight: '300px',
  flex: 1
}));

const CalendarContainer = styled(Box)(({ theme }) => ({
  overflowY: 'auto',
  maxHeight: '400px',
  flex: 1
}));

// All'interno del componente Dashboard
import { useNavigate } from 'react-router-dom';
import LicenseAlert from '../system/LicenseAlert';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState([
    { title: 'Totale Utenti', value: '0', icon: <PeopleIcon />, color: '#2196f3' },
    { title: 'Totale Appuntamenti', value: '0', icon: <TodayIcon />, color: '#ff9800' },
    { title: 'Appuntamenti Completati', value: '0', icon: <CheckCircleIcon />, color: '#4caf50' },
    { title: 'Appuntamenti Cancellati', value: '0', icon: <EventBusyIcon />, color: '#f44336' }
  ]);
  // Define interfaces for the data structures
  interface DashboardAppointment {
    id: number;
    name?: string;
    type?: string;
    time?: string;
    title?: string;
    first_name?: string;
    last_name?: string;
    appointment_date: string;
    date?: string; // Aggiunto per retrocompatibilità
    appointment_time?: string;
    status?: string;
    notes?: string;
  }

  interface Patient {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    created_at: string;
    phone?: string;
    birth_date?: string;
    address?: string;
    city?: string;
    gender?: string;
    fiscal_code?: string;
  }

  interface AppointmentsByDate {
    [key: string]: DashboardAppointment[];
  }

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

  const [todayAppointments, setTodayAppointments] = useState<DashboardAppointment[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<DashboardAppointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [appointmentsByDate, setAppointmentsByDate] = useState<AppointmentsByDate>({});
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Patient | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [userAppointments, setUserAppointments] = useState<DashboardAppointment[]>([]);
  const [openAppointmentDialog, setOpenAppointmentDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<DashboardAppointment | null>(null);

  const handleCloseAppointmentDialog = () => {
    setOpenAppointmentDialog(false);
    setSelectedAppointment(null);
  };



  const fetchMonthAppointments = async (date: Date) => {
    try {
      const start = format(startOfMonth(date), 'yyyy-MM-dd');
      const end = format(endOfMonth(date), 'yyyy-MM-dd');
      
      const response = await axios.get(`http://localhost:3001/api/appointments/range/${start}/${end}`);
      
      // Organize appointments by date
      const appointmentsByDay: AppointmentsByDate = {};
      response.data.forEach((appointment: DashboardAppointment) => {
        try {
          // Verifica che appointment_date sia un valore valido
          if (!appointment.appointment_date) {
            console.warn('Appuntamento senza data valida:', appointment);
            return; // Salta questo appuntamento
          }
          
          // Fix timezone issue by creating a new date object from the date string
          // This ensures the date is interpreted correctly without timezone offset
          const appointmentDate = new Date(appointment.appointment_date);
          
          // Verifica che la data sia valida
          if (isNaN(appointmentDate.getTime())) {
            console.warn('Data non valida per appuntamento:', appointment);
            return; // Salta questo appuntamento
          }
          
          const dateKey = format(appointmentDate, 'yyyy-MM-dd');
          
          if (!appointmentsByDay[dateKey]) {
            appointmentsByDay[dateKey] = [];
          }
          appointmentsByDay[dateKey].push(appointment);
        } catch (err) {
          console.error('Errore durante l\'elaborazione dell\'appuntamento:', appointment, err);
          // Continua con il prossimo appuntamento
        }
      });
      
      setAppointmentsByDate(appointmentsByDay);
    } catch (error) {
      console.error('Error fetching month appointments:', error);
    }
  };
  
  // Navigation handlers for buttons
  const handleViewAllAppointments = () => {
    navigate('/appointments');
  };
  // Fetch user appointments from the API
  const fetchUserAppointments = async (userId: number) => {
    try {
        // Fetch appointments for this user from the API
        const appointmentsResponse = await axios.get(`http://localhost:3001/api/appointments/patient/${userId}`);
        if (appointmentsResponse.data && appointmentsResponse.data.appointments && Array.isArray(appointmentsResponse.data.appointments)) {
            const formattedAppointments = appointmentsResponse.data.appointments.map((appointment: any) => ({
                id: appointment.id,
                appointment_date: appointment.appointment_date || appointment.date,
                time: appointment.appointment_time || appointment.time,
                notes: appointment.notes || '',
                title: appointment.title || '',
                status: appointment.status || 'scheduled'
            }));
            setUserAppointments(formattedAppointments);
        } else {
            // If no appointments or invalid response, show empty list
            setUserAppointments([]);
        }
    } catch (appointmentError) {
        console.error('Error fetching user appointments:', appointmentError);
        setUserAppointments([]);
    }
  };
  const handleViewAllUsers = () => {
    navigate('/users');
  };
  
  const handleAppointmentDetails = (appointmentId: number) => {
    navigate(`/appointments?id=${appointmentId}`);
  };
  
  const handleUserDetails = async (userId: number) => {
    try {
      const response = await axios.get(`http://localhost:3001/api/users/${userId}`);
      setSelectedUser(response.data);
      setOpenUserDialog(true);
      setTabValue(0); // Reset to first tab
      
      // Fetch user appointments from the API
      try {
        // Fetch appointments for this user from the API
        const appointmentsResponse = await axios.get(`http://localhost:3001/api/appointments/patient/${userId}`);
        
        if (appointmentsResponse.data && appointmentsResponse.data.appointments && Array.isArray(appointmentsResponse.data.appointments)) {
          // Map the API response to the expected format
          const formattedAppointments = appointmentsResponse.data.appointments.map((appointment: any) => ({
            id: appointment.id,
            appointment_date: appointment.appointment_date || appointment.date,
            time: appointment.appointment_time || appointment.time,
            notes: appointment.notes || '',
            title: appointment.title || '',
            status: appointment.status || 'scheduled'
          }));
          setUserAppointments(formattedAppointments);
        } else {
          // If no appointments or invalid response, show empty list
          setUserAppointments([]);
        }
      } catch (appointmentError) {
        console.error('Error fetching user appointments:', appointmentError);
        // If error, show empty list
        setUserAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      // Fallback: use the user data we already have
      const user = recentPatients.find(patient => patient.id === userId);
      if (user) {
        setSelectedUser(user);
        setOpenUserDialog(true);
        setTabValue(0); // Reset to first tab
        setUserAppointments([]); // Empty appointments list
      }
    }
  };
  
  const handleCloseUserDialog = () => {
    setOpenUserDialog(false);
    setSelectedUser(null);
    setUserAppointments([]);
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };
  
  // Le funzioni di gestione dei dettagli degli appuntamenti sono state rimoss
  
  // La funzione di filtro degli appuntamenti è stata rimossa

  const handlePrevMonth = () => {
    const prevMonth = subMonths(currentMonth, 1);
    setCurrentMonth(prevMonth);
    fetchMonthAppointments(prevMonth);
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(currentMonth, 1);
    setCurrentMonth(nextMonth);
    fetchMonthAppointments(nextMonth);
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch metrics
        const [usersCount, appointmentsStats] = await Promise.all([
          axios.get('http://localhost:3001/api/users/count'),
          axios.get('http://localhost:3001/api/appointments/stats')
        ]);

        setMetrics([
          { title: 'Totale Utenti', value: usersCount.data.count.toString(), icon: <PeopleIcon />, color: '#2196f3' },
          { title: 'Totale Appuntamenti', value: appointmentsStats.data.total.toString(), icon: <TodayIcon />, color: '#ff9800' },
          { title: 'Appuntamenti Completati', value: appointmentsStats.data.completed.toString(), icon: <CheckCircleIcon />, color: '#4caf50' },
          { title: 'Appuntamenti Cancellati', value: appointmentsStats.data.cancelled.toString(), icon: <EventBusyIcon />, color: '#f44336' }
        ]);

        // Fetch today's appointments
        const todayResponse = await axios.get('http://localhost:3001/api/appointments/today');
        setTodayAppointments(todayResponse.data);

        // Fetch recent patients
        const recentResponse = await axios.get('http://localhost:3001/api/users/recent');
        setRecentPatients(recentResponse.data);

        // Fetch upcoming appointments
        const upcomingResponse = await axios.get('http://localhost:3001/api/appointments/upcoming');
        setUpcomingAppointments(upcomingResponse.data);
        
        // Fetch appointments for current month
        fetchMonthAppointments(currentMonth);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, []);

  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <LicenseAlert />
        
        {/* User Details Dialog */}
        <Dialog open={openUserDialog} onClose={handleCloseUserDialog} maxWidth="lg" fullWidth>
          <DialogTitle>
            <Typography variant="h6" component="h3" fontWeight="bold">Dettagli Utente</Typography>
          </DialogTitle>
          <DialogContent dividers>
            {selectedUser && (
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: '#e8f5e9', color: '#4caf50', width: 60, height: 60, mr: 2 }}>
                    <PersonIcon fontSize="large" />
                  </Avatar>
                  <Box>
                    <Typography variant="h5" fontWeight="bold">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Registrato: {new Date(selectedUser.created_at).toLocaleDateString('it-IT')}
                    </Typography>
                  </Box>
                </Box>
                <Divider sx={{ my: 2 }} />
              </Grid>
              
              {/* Tabs for different sections */}
              <Grid item xs={12}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs value={tabValue} onChange={handleTabChange} aria-label="user details tabs">
                    <Tab label="Informazioni" id="user-tab-0" aria-controls="user-tabpanel-0" />
                  </Tabs>
                </Box>
                
                {/* Informazioni Mediche Tab */}
                <TabPanel value={tabValue} index={0}>
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          Informazioni di Contatto
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
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          Informazioni Personali
                        </Typography>
                        {selectedUser.birth_date && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <CakeIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="body1">
                              Data di nascita: {new Date(selectedUser.birth_date).toLocaleDateString('it-IT')}
                            </Typography>
                          </Box>
                        )}
                        {selectedUser.gender && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="body1">Genere: {selectedUser.gender}</Typography>
                          </Box>
                        )}
                        {selectedUser.fiscal_code && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Badge sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="body1">Codice Fiscale: {selectedUser.fiscal_code}</Typography>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                          Indirizzo
                        </Typography>
                        {(selectedUser.address || selectedUser.city) && (
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <LocationOnIcon sx={{ mr: 1, color: 'primary.main' }} />
                            <Typography variant="body1">
                              {selectedUser.address}{selectedUser.address && selectedUser.city ? ', ' : ''}{selectedUser.city}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                </TabPanel>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUserDialog} color="primary">
            Chiudi
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Appointment Details Dialog */}
      <Dialog 
        open={openAppointmentDialog} 
        onClose={handleCloseAppointmentDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h6" fontWeight="bold">Dettagli Appuntamento</Typography>
        </DialogTitle>
        <DialogContent dividers>
          {selectedAppointment && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    <CalendarTodayIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                    Data e Ora
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="body1">
                      {format(new Date(selectedAppointment.appointment_date), 'dd MMMM yyyy', { locale: it })}
                    </Typography>
                    <Typography variant="body1">
                      Ora: {selectedAppointment.time}
                    </Typography>
                  </Paper>
                </Box>
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    <NoteIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                    Note
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body1">
                      {selectedAppointment.notes || 'Nessuna nota disponibile'}
                    </Typography>
                  </Paper>
                </Box>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAppointmentDialog} color="primary">
            Chiudi
          </Button>
        </DialogActions>
      </Dialog>

          <Container maxWidth="xl">
            {/* Header - removed the three buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
              <Typography variant="h4" fontWeight="bold">Dashboard</Typography>
            </Box>
            
            {/* Metrics */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              {metrics.map((metric, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <ContentCard>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Avatar sx={{ bgcolor: metric.color + '15', color: metric.color, mr: 2 }}>
                        {metric.icon}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {metric.title}
                        </Typography>
                        <Typography variant="h5" fontWeight="bold">
                          {metric.value}
                        </Typography>
                      </Box>
                    </Box>
                  </ContentCard>
                </Grid>
              ))}
            </Grid>
            
            <Grid container spacing={3}>
              {/* Calendar */}
              <Grid item xs={12} md={6}>
                <ContentCard>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <SectionTitle variant="h6">Calendario Mensile</SectionTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <IconButton onClick={handlePrevMonth} size="small">
                        <ArrowBackIosNewIcon fontSize="small" />
                      </IconButton>
                      <Typography variant="subtitle1" sx={{ mx: 1, whiteSpace: 'nowrap' }}>
                        {format(currentMonth, 'MMMM yyyy', { locale: it })}
                      </Typography>
                      <IconButton onClick={handleNextMonth} size="small">
                        <ArrowForwardIosIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  
                  <CalendarContainer>
                    <Grid container spacing={1}>
                      {/* Calendar header */}
                      <Grid item xs={12}>
                        <Grid container>
                          {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
                            <Grid item xs={12/7} key={day}>
                              <Typography variant="body2" align="center" sx={{ fontWeight: 'bold' }}>
                                {day}
                              </Typography>
                            </Grid>
                          ))}
                        </Grid>
                      </Grid>
                      
                      {/* Calendar days */}
                      <Grid item xs={12}>
                        <Grid container spacing={1}>
                          {eachDayOfInterval({
                            start: startOfMonth(currentMonth),
                            end: endOfMonth(currentMonth)
                          }).map((day, index) => {
                            const dateKey = format(day, 'yyyy-MM-dd');
                            const hasAppointments = appointmentsByDate[dateKey] && appointmentsByDate[dateKey].length > 0;
                            const appointmentsCount = hasAppointments ? appointmentsByDate[dateKey].length : 0;
                            
                            return (
                              <Grid item xs={12/7} key={index}>
                                <Paper 
                                  elevation={0} 
                                  sx={{
                                    p: 1,
                                    textAlign: 'center',
                                    bgcolor: hasAppointments ? '#e3f2fd' : '#f5f5f5',
                                    borderRadius: 1,
                                    position: 'relative',
                                    height: '40px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center'
                                  }}
                                >
                                  <Typography variant="body2">
                                    {getDate(day)}
                                  </Typography>
                                  {hasAppointments && (
                                    <Chip 
                                      label={appointmentsCount} 
                                      size="small" 
                                      color="primary" 
                                      sx={{ 
                                        height: '16px',
                                        fontSize: '0.6rem',
                                        position: 'absolute',
                                        top: '2px',
                                        right: '2px'
                                      }} 
                                    />
                                  )}
                                </Paper>
                              </Grid>
                            );
                          })}
                        </Grid>
                      </Grid>
                    </Grid>
                  </CalendarContainer>
                </ContentCard>
              </Grid>
              
              {/* Today's Appointments */}
              <Grid item xs={12} md={6}>
                <ContentCard>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <SectionTitle variant="h6">Appuntamenti di Oggi</SectionTitle>
                    <Button 
                      size="small" 
                      onClick={handleViewAllAppointments}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Vedi tutti
                    </Button>
                  </Box>
                  
                  <AppointmentsList>
                    {todayAppointments.length > 0 ? (
                      todayAppointments.map((appointment) => (
                        <AppointmentItem key={appointment.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Avatar sx={{ bgcolor: '#e8f5e9', color: '#4caf50', mr: 2 }}>
                              <CalendarTodayIcon />
                            </Avatar>
                            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {appointment.title || 'Appuntamento'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                                <AccessTime fontSize="small" sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                                {appointment.appointment_time || appointment.time}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <PersonIcon fontSize="small" sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                                {appointment.first_name && appointment.last_name 
                                  ? `${appointment.first_name} ${appointment.last_name}` 
                                  : appointment.name || 'Paziente'}
                              </Typography>
                            </Box>
                            <Button 
                              size="small" 
                              variant="outlined" 
                              startIcon={<VisibilityIcon />}
                              onClick={() => handleAppointmentDetails(appointment.id)}
                              sx={{ ml: 1, whiteSpace: 'nowrap' }}
                            >
                              Dettagli
                            </Button>
                          </Box>
                        </AppointmentItem>
                      ))
                    ) : (
                      <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body1" color="text.secondary">
                          Nessun appuntamento oggi
                        </Typography>
                      </Box>
                    )}
                  </AppointmentsList>
                </ContentCard>
              </Grid>
              
              {/* Recent Patients */}
              <Grid item xs={12} md={6}>
                <ContentCard>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <SectionTitle variant="h6">Utenti Recenti</SectionTitle>
                    <Button 
                      size="small" 
                      onClick={handleViewAllUsers}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Vedi tutti
                    </Button>
                  </Box>
                  
                  <PatientsList>
                    {recentPatients.map((patient) => (
                      <AppointmentItem key={patient.id}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <Avatar sx={{ bgcolor: '#e3f2fd', color: '#2196f3', mr: 2 }}>
                            <PersonIcon />
                          </Avatar>
                          <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {patient.first_name} {patient.last_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              <EmailIcon fontSize="small" sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                              {patient.email}
                            </Typography>
                          </Box>
                          <Button 
                            size="small" 
                            variant="outlined" 
                            startIcon={<VisibilityIcon />}
                            onClick={() => handleUserDetails(patient.id)}
                            sx={{ ml: 1, whiteSpace: 'nowrap' }}
                          >
                            Dettagli
                          </Button>
                        </Box>
                      </AppointmentItem>
                    ))}
                  </PatientsList>
                </ContentCard>
              </Grid>
              
              {/* Upcoming Appointments */}
              <Grid item xs={12} md={6}>
                <ContentCard>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <SectionTitle variant="h6">Prossimi Appuntamenti</SectionTitle>
                    <Button 
                      size="small" 
                      onClick={handleViewAllAppointments}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      Vedi tutti
                    </Button>
                  </Box>
                  
                  <AppointmentsList>
                    {upcomingAppointments.length > 0 ? (
                      upcomingAppointments.map((appointment) => (
                        <AppointmentItem key={appointment.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <Avatar sx={{ bgcolor: '#fff8e1', color: '#ff9800', mr: 2 }}>
                              <CalendarTodayIcon />
                            </Avatar>
                            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {appointment.title || 'Appuntamento'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                {formatDate(appointment.appointment_date || appointment.date || '')}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center' }}>
                                <AccessTime fontSize="small" sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                                {appointment.appointment_time || appointment.time}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <PersonIcon fontSize="small" sx={{ mr: 0.5, fontSize: '0.9rem' }} />
                                {appointment.first_name && appointment.last_name 
                                  ? `${appointment.first_name} ${appointment.last_name}` 
                                  : appointment.name || 'Paziente'}
                              </Typography>
                            </Box>
                            <Button 
                              size="small" 
                              variant="outlined" 
                              startIcon={<VisibilityIcon />}
                              onClick={() => handleAppointmentDetails(appointment.id)}
                              sx={{ ml: 1, whiteSpace: 'nowrap' }}
                            >
                              Dettagli
                            </Button>
                          </Box>
                        </AppointmentItem>
                      ))
                    ) : (
                      <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body1" color="text.secondary">
                          Nessun appuntamento in programma
                        </Typography>
                      </Box>
                    )}
                  </AppointmentsList>
                </ContentCard>
              </Grid>
            </Grid>
          </Container>
      </Box>
    </Box>
  );

};

export default Dashboard;