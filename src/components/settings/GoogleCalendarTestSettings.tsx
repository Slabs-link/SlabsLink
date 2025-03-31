import React, { useState } from 'react';
import { Box, Typography, Button, Paper, Grid, Alert, CircularProgress, TextField } from '@mui/material';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

interface TestResult {
  success: boolean;
  message: string;
  details?: any;
}

export const GoogleCalendarTestSettings: React.FC = () => {
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResult, setStatusResult] = useState<TestResult | null>(null);
  
  const [syncingAppointments, setSyncingAppointments] = useState(false);
  const [syncResult, setSyncResult] = useState<TestResult | null>(null);
  
  const [testingAppointment, setTestingAppointment] = useState(false);
  const [appointmentId, setAppointmentId] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  
  const [setupWebhook, setSetupWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<TestResult | null>(null);
  
  const handleCheckStatus = async () => {
    setCheckingStatus(true);
    setStatusResult(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/google-calendar/status`);
      setStatusResult({
        success: true,
        message: 'Stato dell\'integrazione verificato con successo',
        details: response.data
      });
    } catch (error: any) {
      setStatusResult({
        success: false,
        message: 'Errore durante la verifica dello stato dell\'integrazione',
        details: error.response?.data || error.message
      });
    } finally {
      setCheckingStatus(false);
    }
  };
  
  const handleSyncAppointments = async () => {
    setSyncingAppointments(true);
    setSyncResult(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/google-calendar/sync`);
      setSyncResult({
        success: true,
        message: 'Sincronizzazione completata con successo',
        details: response.data
      });
    } catch (error: any) {
      setSyncResult({
        success: false,
        message: 'Errore durante la sincronizzazione',
        details: error.response?.data || error.message
      });
    } finally {
      setSyncingAppointments(false);
    }
  };
  
  const handleTestAppointment = async () => {
    if (!appointmentId || isNaN(Number(appointmentId))) {
      setTestResult({
        success: false,
        message: 'Inserisci un ID appuntamento valido'
      });
      return;
    }
    
    setTestingAppointment(true);
    setTestResult(null);
    
    try {
      const response = await axios.get(`${API_BASE_URL}/google-calendar/test-sync/${appointmentId}`);
      setTestResult({
        success: true,
        message: `Test sincronizzazione appuntamento ${appointmentId} completato`,
        details: response.data
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `Errore durante il test dell'appuntamento ${appointmentId}`,
        details: error.response?.data || error.message
      });
    } finally {
      setTestingAppointment(false);
    }
  };
  
  const handleSetupWebhook = async () => {
    setSetupWebhook(true);
    setWebhookResult(null);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/google-calendar/setup-webhook`);
      setWebhookResult({
        success: true,
        message: 'Webhook configurato con successo',
        details: response.data
      });
    } catch (error: any) {
      setWebhookResult({
        success: false,
        message: 'Errore durante la configurazione del webhook',
        details: error.response?.data || error.message
      });
    } finally {
      setSetupWebhook(false);
    }
  };
  
  const renderTestResult = (result: TestResult | null, loading: boolean) => {
    if (loading) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
          <CircularProgress size={20} sx={{ mr: 2 }} />
          <Typography>Elaborazione in corso...</Typography>
        </Box>
      );
    }
    
    if (!result) return null;
    
    return (
      <Alert severity={result.success ? 'success' : 'error'} sx={{ mt: 2 }}>
        <Typography variant="body1">{result.message}</Typography>
        {result.details && (
          <Paper sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5', maxHeight: '200px', overflow: 'auto' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(result.details, null, 2)}
            </pre>
          </Paper>
        )}
      </Alert>
    );
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>Test Google Calendar</Typography>
      <Alert severity="info" sx={{ mb: 3 }}>
        Questa sezione permette di testare le funzionalità di integrazione con Google Calendar.
        Assicurati di aver configurato correttamente le credenziali e di aver autorizzato l'applicazione.
      </Alert>
      
      <Grid container spacing={3}>
        {/* Verifica stato integrazione */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Verifica stato integrazione
            </Typography>
            <Typography variant="body2" paragraph>
              Verifica lo stato attuale dell'integrazione con Google Calendar, inclusi i token di accesso e le informazioni sul calendario selezionato.
            </Typography>
            <Button 
              variant="contained" 
              color="primary"
              onClick={handleCheckStatus}
              disabled={checkingStatus}
            >
              Verifica Stato
            </Button>
            {renderTestResult(statusResult, checkingStatus)}
          </Paper>
        </Grid>
        
        {/* Sincronizza appuntamenti */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Sincronizza tutti gli appuntamenti
            </Typography>
            <Typography variant="body2" paragraph>
              Forza la sincronizzazione di tutti gli appuntamenti non sincronizzati con Google Calendar.
            </Typography>
            <Button 
              variant="contained" 
              color="primary"
              onClick={handleSyncAppointments}
              disabled={syncingAppointments}
            >
              Sincronizza Appuntamenti
            </Button>
            {renderTestResult(syncResult, syncingAppointments)}
          </Paper>
        </Grid>
        
        {/* Test sincronizzazione appuntamento specifico */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Test sincronizzazione appuntamento specifico
            </Typography>
            <Typography variant="body2" paragraph>
              Testa la sincronizzazione di un appuntamento specifico con Google Calendar.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <TextField
                label="ID Appuntamento"
                variant="outlined"
                size="small"
                value={appointmentId}
                onChange={(e) => setAppointmentId(e.target.value)}
                sx={{ mr: 2, width: '200px' }}
              />
              <Button 
                variant="contained" 
                color="primary"
                onClick={handleTestAppointment}
                disabled={testingAppointment}
              >
                Testa Sincronizzazione
              </Button>
            </Box>
            {renderTestResult(testResult, testingAppointment)}
          </Paper>
        </Grid>
        
        {/* Configura webhook */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Configura webhook
            </Typography>
            <Typography variant="body2" paragraph>
              Configura il webhook per ricevere notifiche in tempo reale da Google Calendar quando gli eventi vengono modificati.
            </Typography>
            <Button 
              variant="contained" 
              color="primary"
              onClick={handleSetupWebhook}
              disabled={setupWebhook}
            >
              Configura Webhook
            </Button>
            {renderTestResult(webhookResult, setupWebhook)}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};