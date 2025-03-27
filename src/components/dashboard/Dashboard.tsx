import React, { useState, useEffect } from 'react';
import { Box, Typography, Container, Grid, Paper, Avatar, Button, Card, CardContent, Badge, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Divider, TextField, Tabs, Tab, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
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
  height: '100%'
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
  const [appointmentFilterStatus, setAppointmentFilterStatus] = useState('all');
  const [openAppointmentDialog, setOpenAppointmentDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<DashboardAppointment | null>(null);

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
            date: appointment.appointment_date || appointment.date,
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
  
  const handleViewAppointmentDetails = (appointment: DashboardAppointment) => {
    setSelectedAppointment(appointment);
    setOpenAppointmentDialog(true);
  };
  
  const handleCloseAppointmentDialog = () => {
    setOpenAppointmentDialog(false);
    setSelectedAppointment(null);
  };
  
  const handleAppointmentFilterChange = (event: any) => {
    setAppointmentFilterStatus(event.target.value);
  };

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
            <Typography variant="h6" fontWeight="bold">Dettagli Utente</Typography>
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
                    <Tab label="INFORMAZIONI MEDICHE" id="user-tab-0" aria-controls="user-tabpanel-0" />
                    <Tab label="APPUNTAMENTI" id="user-tab-1" aria-controls="user-tabpanel-1" />
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
                
                {/* Appointments Tab */}
                <TabPanel value={tabValue} index={1}>
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      <CalendarTodayIcon sx={{ mr: 1, verticalAlign: 'middle', color: 'primary.main' }} />
                      Appuntamenti
                    </Typography>
                    
                    {/* Filtro per stato appuntamenti */}
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="appointment-status-filter-label">Filtra per stato</InputLabel>
                      <Select
                        labelId="appointment-status-filter-label"
                        id="appointment-status-filter"
                        label="Filtra per stato"
                        value={appointmentFilterStatus}
                        onChange={handleAppointmentFilterChange}
                      >
                        <MenuItem value="all">Tutti</MenuItem>
                        <MenuItem value="scheduled">Programmati</MenuItem>
                        <MenuItem value="completed">Completati</MenuItem>
                        <MenuItem value="cancelled">Cancellati</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                  
                  {userAppointments.length > 0 ? (
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                          <TableRow>
                            <TableCell>Data</TableCell>
                            <TableCell>Ora</TableCell>
                            <TableCell>Titolo</TableCell>
                            <TableCell>Note</TableCell>
                            <TableCell>Stato</TableCell>
                            <TableCell align="center">Azioni</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {userAppointments
                            .filter(appointment => appointmentFilterStatus === 'all' || appointment.status === appointmentFilterStatus)
                            .map((appointment) => (
                              <TableRow key={appointment.id}>
                                <TableCell>
                                  {format(new Date(appointment.appointment_date), 'dd/MM/yyyy', { locale: it })}
                                </TableCell>
                                <TableCell>{appointment.time}</TableCell>
                                <TableCell>{appointment.title || '-'}</TableCell>
                                <TableCell>{appointment.notes || '-'}</TableCell>
                                <TableCell>
                                  <Box
                                    sx={{
                                      display: 'inline-block',
                                      px: 1,
                                      py: 0.5,
                                      borderRadius: 1,
                                      bgcolor: appointment.status === 'completed' ? '#e8f5e9' : 
                                               appointment.status === 'scheduled' ? '#e3f2fd' : '#fff3e0',
                                      color: appointment.status === 'completed' ? '#2e7d32' : 
                                             appointment.status === 'scheduled' ? '#1565c0' : '#e65100',
                                      fontSize: '0.75rem',
                                      fontWeight: 'bold'
                                    }}
                                  >
                                    {appointment.status === 'completed' ? 'Completato' : 
                                     appointment.status === 'scheduled' ? 'Programmato' : 'Cancellato'}
                                  </Box>
                                </TableCell>
                                <TableCell align="center">
                                  <IconButton 
                                    size="small" 
                                    color="primary" 
                                    title="Visualizza dettagli"
                                    onClick={() => handleViewAppointmentDetails(appointment)}
                                  >
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                      <Typography variant="body1" color="text.secondary">
                        Nessun appuntamento trovato per questo utente
                      </Typography>
                    </Paper>
                  )}
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
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
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
          
          {/* Metrics - Adjusted to display all 4 cards in a single row */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {metrics.map((metric, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card sx={{ bgcolor: 'white' }}>
                  <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar sx={{ bgcolor: metric.color + '15', color: metric.color, mr: 2 }}>
                      {metric.icon}
                    </Avatar>
                    <Box>
                      <Typography variant="h5" fontWeight="bold">{metric.value}</Typography>
                      <Typography variant="body2" color="text.secondary">{metric.title}</Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>



          {/* Content */}
          <Grid container spacing={3}>
            {/* First row: Monthly Calendar, Today's Appointments and Upcoming Appointments side by side */}
            <Grid item xs={12} md={6}>
              <ContentCard>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">Calendario Mensile</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton onClick={handlePrevMonth}>
                      <ArrowBackIosNewIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="subtitle1" sx={{ mx: 2 }}>
                      {format(currentMonth, 'MMMM yyyy', { locale: it })}
                    </Typography>
                    <IconButton onClick={handleNextMonth}>
                      <ArrowForwardIosIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
                
                <Grid container spacing={1}>
                  {/* Day names */}
                  {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
                    <Grid item xs={12/7} key={day}>
                      <Box sx={{ textAlign: 'center', py: 1, fontWeight: 'bold' }}>
                        <Typography variant="body2">{day}</Typography>
                      </Box>
                    </Grid>
                  ))}
                  
                  {/* Calendar days */}
                  {eachDayOfInterval({
                    start: startOfMonth(currentMonth),
                    end: endOfMonth(currentMonth)
                  }).map((day, index) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const appointmentsForDay = appointmentsByDate[dateStr] || [];
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    
                    return (
                      <Grid item xs={12/7} key={index}>
                        <Box sx={{
                          height: 50,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: 1,
                          borderRadius: 1,
                          bgcolor: isCurrentMonth ? '#fff' : '#f5f5f5',
                          border: '1px solid #eee',
                          position: 'relative'
                        }}>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: isCurrentMonth ? 'text.primary' : 'text.disabled',
                              fontWeight: isCurrentMonth ? 'medium' : 'normal'
                            }}
                          >
                            {getDate(day)}
                          </Typography>
                          
                          {appointmentsForDay.length > 0 && (
                            <Badge 
                              badgeContent={appointmentsForDay.length} 
                              color="primary"
                              sx={{ 
                                position: 'absolute',
                                top: 2,
                                right: 2,
                                '& .MuiBadge-badge': {
                                  fontSize: '0.6rem',
                                  height: 16,
                                  minWidth: 16,
                                  padding: '0 4px'
                                }
                              }}
                            />
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              </ContentCard>
            </Grid>
            
            {/* Today's Appointments - in the middle */}
            <Grid item xs={12} md={3}>
              <ContentCard sx={{ height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">Appuntamenti di Oggi</Typography>
                  <Button size="small" color="primary" onClick={handleViewAllAppointments}>Vedi tutti</Button>
                </Box>
                
                {todayAppointments.length > 0 ? todayAppointments.map(appointment => (
                  <AppointmentItem key={appointment.id}>
                    <Avatar sx={{ bgcolor: '#e3f2fd', color: '#2196f3', mr: 2 }}>
                      <CalendarTodayIcon />
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight="medium">{appointment.name || appointment.title || 'Appuntamento'}</Typography>
                      <Typography variant="body2" color="text.secondary">{appointment.type || 'Visita'}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="subtitle1">{appointment.time || appointment.appointment_time}</Typography>
                      <Button size="small" color="primary" onClick={() => handleAppointmentDetails(appointment.id)}>Dettagli</Button>
                    </Box>
                  </AppointmentItem>
                )) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    Nessun appuntamento oggi
                  </Typography>
                )}
              </ContentCard>
            </Grid>
            
            {/* Upcoming Appointments - moved to the right of Today's Appointments */}
            <Grid item xs={12} md={3}>
              <ContentCard sx={{ height: '100%' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">Prossimi Appuntamenti</Typography>
                  <Button size="small" color="primary" onClick={handleViewAllAppointments}>Vedi tutti</Button>
                </Box>
                
                {upcomingAppointments.length > 0 ? (
                  <Box sx={{ maxHeight: '400px', overflow: 'auto' }}>
                    {upcomingAppointments.map(appointment => (
                      <AppointmentItem key={appointment.id}>
                        <Avatar sx={{ bgcolor: '#e3f2fd', color: '#2196f3', mr: 2 }}>
                          <CalendarTodayIcon />
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" fontWeight="medium">
                            {appointment.title || 'Appuntamento'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {appointment.first_name} {appointment.last_name}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                            <Typography variant="body2">
                              {new Date(appointment.appointment_date).toLocaleDateString('it-IT')}
                            </Typography>
                            <Typography variant="body2">{appointment.appointment_time}</Typography>
                          </Box>
                        </Box>
                        <Button size="small" color="primary" onClick={() => handleAppointmentDetails(appointment.id)}>Dettagli</Button>
                      </AppointmentItem>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    Nessun appuntamento in programma
                  </Typography>
                )}
              </ContentCard>
            </Grid>
            
            {/* Recent Patients - moved below the first row */}
            <Grid item xs={12} md={12}>
              <ContentCard>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">Utenti Recenti</Typography>
                  <Button size="small" color="primary" onClick={handleViewAllUsers}>Vedi tutti</Button>
                </Box>
                
                {recentPatients.length > 0 ? (
                  <Grid container spacing={2}>
                    {recentPatients.map(patient => (
                      <Grid item xs={12} sm={6} md={4} key={patient.id}>
                        <Box sx={{ display: 'flex', p: 2, border: '1px solid #f0f0f0', borderRadius: 1 }}>
                          <Avatar sx={{ bgcolor: '#e8f5e9', color: '#4caf50', mr: 2 }}>
                            <PersonIcon />
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle1" fontWeight="medium">
                              {patient.first_name} {patient.last_name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {patient.email}
                            </Typography>
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Registrato: {new Date(patient.created_at).toLocaleDateString('it-IT')}
                            </Typography>
                          </Box>
                          <Button size="small" color="primary" onClick={() => handleUserDetails(patient.id)}>Dettagli</Button>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    Nessun utente recente
                  </Typography>
                )}
              </ContentCard>
            </Grid>
          </Grid>
        </Container>
      </Box>
    </Box>
  );
};

export default Dashboard;