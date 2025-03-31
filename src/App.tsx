import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/dashboard/Dashboard';
import Patients from './components/patients/Patients';
import Appointments from './components/appointments/Appointments';
import Settings from './components/settings/Settings';
import { SetupWizard } from './components/setup/SetupWizard';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/theme';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { it } from 'date-fns/locale';
import axios from 'axios';
// Add missing imports for components referenced in routes
import Calendar from './components/calendar/Calendar';
//import Patients from './components/patients/Patients';
import Notifications from './components/notifications/Notifications';
import TemplateManager from './components/templates/TemplateManager';
import LicenseCheck from './components/system/LicenseCheck';
import GoogleAuthCallback from './components/settings/GoogleAuthCallback';

// API base URL - will connect to our backend
const API_BASE_URL = 'http://localhost:3001/api';

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Call the backend API to check if setup is complete
        const response = await axios.get(`${API_BASE_URL}/setup/status`);
        console.log('Setup status response:', response.data);
        setIsSetupComplete(response.data.setup_complete || response.data.complete);
      } catch (error) {
        console.error('Error checking setup status:', error);
        // If API call fails, check localStorage as fallback
        const setupCompleteInStorage = localStorage.getItem('setupComplete') === 'true';
        setIsSetupComplete(setupCompleteInStorage);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSetup();
  }, []);
  
  if (isLoading) {
    return <div>Verifica configurazione...</div>;
  }
  
  return (
    <ThemeProvider theme={theme}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={it}>
        <Router>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/setup" element={<SetupWizard />} />
            {/* Aggiungi una route per gestire il reindirizzamento dopo l'autenticazione di Google Calendar */}
            <Route path="/auth/google/callback" element={<Navigate to="/settings?tab=calendar&auth=success" />} />
          </Routes>
        </Router>
      </LocalizationProvider>
    </ThemeProvider>
  );
}

export default App;