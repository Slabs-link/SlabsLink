import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme/theme';
//import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import { SetupWizard } from './components/setup/SetupWizard';
import Users from './components/users/Users';
import Appointments from './components/appointments/Appointments';
import Settings from './components/settings/Settings';
import axios from 'axios';
// Add missing imports for components referenced in routes
import Calendar from './components/calendar/Calendar';
import Patients from './components/patients/Patients';
import Notifications from './components/notifications/Notifications';
import TemplateManager from './components/templates/TemplateManager';
import LicenseCheck from './components/system/LicenseCheck';

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
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/setup" element={<SetupWizard />} />
          <Route path="/dashboard" element={
            isSetupComplete ? (
              <LicenseCheck>
                <Dashboard />
              </LicenseCheck>
            ) : <Navigate to="/setup" />
          } />
          <Route path="/calendar" element={
            isSetupComplete ? (
              <LicenseCheck>
                <Calendar />
              </LicenseCheck>
            ) : <Navigate to="/setup" />
          } />
          <Route path="/patients" element={
            isSetupComplete ? (
              <LicenseCheck>
                <Patients />
              </LicenseCheck>
            ) : <Navigate to="/setup" />
          } />
          <Route path="/users" element={
            isSetupComplete ? (
              <LicenseCheck>
                <Users />
              </LicenseCheck>
            ) : <Navigate to="/setup" />
          } />
          <Route path="/appointments" element={
            isSetupComplete ? (
              <LicenseCheck>
                <Appointments />
              </LicenseCheck>
            ) : <Navigate to="/setup" />
          } />
          <Route path="/notifications" element={
            isSetupComplete ? (
              <LicenseCheck>
                <Notifications />
              </LicenseCheck>
            ) : <Navigate to="/setup" />
          } />
          <Route path="/settings" element={
            isSetupComplete ? <Settings /> : <Navigate to="/setup" />
          } />
          <Route path="/templates" element={
            isSetupComplete ? (
              <LicenseCheck>
                <TemplateManager />
              </LicenseCheck>
            ) : <Navigate to="/setup" />
          } />
          <Route path="/" element={
            isSetupComplete ? <Navigate to="/dashboard" /> : <Navigate to="/setup" />
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;