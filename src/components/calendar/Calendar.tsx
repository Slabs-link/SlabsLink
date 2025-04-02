import React, { useState } from 'react';
import { Box, Typography, Container, Button, Grid, Paper, ButtonGroup, IconButton } from '@mui/material';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '@mui/material/styles';
import Sidebar from '../common/Sidebar';

const DayCell = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  height: '150px',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#f8f9fa',
  borderRadius: '4px',
  overflow: 'hidden'
}));

// Aggiungo nuovi componenti styled per migliorare il layout
const SectionTitle = styled(Typography)(({ theme }) => ({
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontWeight: 'bold'
}));

const CalendarGrid = styled(Grid)(({ theme }) => ({
  overflowY: 'auto',
  maxHeight: '70vh'
}));

const Calendar: React.FC = () => {
  const [currentWeek, setCurrentWeek] = useState({
    start: '17 marzo',
    end: '23 marzo',
    year: '2025'
  });
  
  const [viewMode, setViewMode] = useState<'Giorno' | 'Settimana' | 'Mese'>('Settimana');
  
  const days = [
    { name: 'lunedì', number: 17, appointments: [] },
    { name: 'martedì', number: 18, appointments: [] },
    { name: 'mercoledì', number: 19, appointments: [] },
    { name: 'giovedì', number: 20, appointments: [] },
    { name: 'venerdì', number: 21, appointments: [] },
    { name: 'sabato', number: 22, appointments: [] },
    { name: 'domenica', number: 23, appointments: [] }
  ];
  
  const handlePrevWeek = () => {
    // Logic to go to previous week
  };
  
  const handleNextWeek = () => {
    // Logic to go to next week
  };
  
  return (
    <Box sx={{ display: 'flex', bgcolor: '#fafafa', minHeight: '100vh' }}>
      <Sidebar />
      
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Container maxWidth="xl">
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <SectionTitle variant="h4">Calendario Appuntamenti</SectionTitle>
            
            <Box>
              <ButtonGroup variant="outlined" sx={{ mr: 2 }}>
                <Button 
                  variant={viewMode === 'Giorno' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('Giorno')}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Giorno
                </Button>
                <Button 
                  variant={viewMode === 'Settimana' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('Settimana')}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Settimana
                </Button>
                <Button 
                  variant={viewMode === 'Mese' ? 'contained' : 'outlined'}
                  onClick={() => setViewMode('Mese')}
                  sx={{ whiteSpace: 'nowrap' }}
                >
                  Mese
                </Button>
              </ButtonGroup>
              
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                color="primary"
                sx={{ whiteSpace: 'nowrap' }}
              >
                Nuovo Appuntamento
              </Button>
            </Box>
          </Box>
          
          {/* Week Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <IconButton onClick={handlePrevWeek}>
              <ArrowBackIosNewIcon />
            </IconButton>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mx: 2 }}>
              <CalendarTodayIcon sx={{ mr: 1 }} />
              <Typography variant="h6" sx={{ whiteSpace: 'nowrap' }}>
                {currentWeek.start} - {currentWeek.end} {currentWeek.year}
              </Typography>
            </Box>
            
            <IconButton onClick={handleNextWeek}>
              <ArrowForwardIosIcon />
            </IconButton>
          </Box>
          
          {/* Calendar Grid */}
          <CalendarGrid container spacing={1}>
            {days.map((day) => (
              <Grid item xs key={day.name}>
                <DayCell elevation={0}>
                  <Typography variant="subtitle1" align="center" sx={{ fontWeight: 'bold', mb: 1, whiteSpace: 'nowrap' }}>
                    {day.name}
                  </Typography>
                  <Typography variant="h6" align="center" sx={{ mb: 2 }}>
                    {day.number}
                  </Typography>
                  
                  {day.appointments.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center">
                      Nessun appuntamento
                    </Typography>
                  ) : (
                    day.appointments.map((appointment) => (
                      // Render appointments here
                      <Box key={appointment} sx={{ mb: 1, p: 1, bgcolor: '#e3f2fd', borderRadius: 1, overflow: 'hidden' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          Appuntamento
                        </Typography>
                      </Box>
                    ))
                  )}
                </DayCell>
              </Grid>
            ))}
          </CalendarGrid>
        </Container>
      </Box>
    </Box>
  );
};

export default Calendar;