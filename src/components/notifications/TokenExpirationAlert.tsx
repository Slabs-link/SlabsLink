import React, { useState, useEffect } from 'react';
import { Alert, Button, Snackbar, Box, Typography } from '@mui/material';
import axios from 'axios';

// Definisci l'URL base per le API
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000/api'
  : '/api';

interface TokenExpirationAlertProps {
  // Proprietà opzionale per forzare la visualizzazione dell'alert (utile per test)
  forceShow?: boolean;
}

/**
 * Componente che mostra un alert quando i token di Google Calendar sono scaduti
 * e offre un pulsante per riautenticarsi facilmente.
 */
const TokenExpirationAlert: React.FC<TokenExpirationAlertProps> = ({ forceShow = false }) => {
  const [showAlert, setShowAlert] = useState<boolean>(forceShow);
  const [calendarSettings, setCalendarSettings] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('I token di Google Calendar sono scaduti. È necessario riautenticarsi.');

  // Controlla lo stato dell'autenticazione di Google Calendar
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setLoading(true);
        // Ottieni lo stato dell'autenticazione di Google Calendar
        const response = await axios.get(`${API_BASE_URL}/google-calendar/auth-status`);
        
        // Se l'API restituisce un errore di autenticazione, mostra l'alert
        if (response.data && (response.data.error === 'token_expired' || response.data.error === 'token_invalid')) {
          setShowAlert(true);
          // Usa il messaggio fornito dall'API se disponibile
          if (response.data.message) {
            setErrorMessage(response.data.message);
          } else if (response.data.error === 'token_expired') {
            setErrorMessage('Il token di Google Calendar è scaduto o è stato revocato. È necessario riautenticarsi.');
          } else if (response.data.error === 'token_invalid') {
            setErrorMessage('Il token di Google Calendar non è valido. È necessario riautenticarsi.');
          }
        } else {
          setShowAlert(forceShow); // Usa il valore di forceShow
        }

        // Ottieni le impostazioni del calendario per il pulsante di riautenticazione
        const calendarResponse = await axios.get(`${API_BASE_URL}/settings/calendar`);
        setCalendarSettings(calendarResponse.data.calendar);
      } catch (err) {
        console.error('Errore durante il controllo dello stato di autenticazione:', err);
        // Se riceviamo un errore 401, è probabile che i token siano scaduti
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          setShowAlert(true);
          setErrorMessage('Autenticazione Google Calendar scaduta. È necessario riautenticarsi.');
        }
        setError('Impossibile verificare lo stato di autenticazione');
      } finally {
        setLoading(false);
      }
    };

    // Esegui il controllo all'avvio del componente
    checkAuthStatus();

    // Imposta un intervallo per controllare periodicamente lo stato (ogni 5 minuti)
    const intervalId = setInterval(checkAuthStatus, 5 * 60 * 1000);

    // Pulisci l'intervallo quando il componente viene smontato
    return () => clearInterval(intervalId);
  }, [forceShow]);

  // Gestisce la chiusura dell'alert
  const handleClose = () => {
    setShowAlert(false);
  };

  // Gestisce il click sul pulsante di riautenticazione
  const handleReauthenticate = () => {
    if (calendarSettings && calendarSettings.clientId && calendarSettings.clientSecret && calendarSettings.redirectUri) {
      // Reindirizza l'utente alla pagina di autenticazione di Google
      window.location.href = `${API_BASE_URL}/google-calendar/auth?clientId=${calendarSettings.clientId}&clientSecret=${calendarSettings.clientSecret}&redirectUri=${calendarSettings.redirectUri}`;
    } else {
      // Se le impostazioni non sono disponibili, reindirizza alla pagina delle impostazioni
      window.location.href = '/settings?tab=calendar';
    }
  };

  // Non mostrare nulla se non c'è bisogno di mostrare l'alert o se stiamo ancora caricando
  if (!showAlert || loading) {
    return null;
  }

  return (
    <Snackbar 
      open={showAlert} 
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ width: '100%', maxWidth: '600px', top: '80px !important' }}
    >
      <Alert 
        severity="warning" 
        variant="filled"
        onClose={handleClose}
        sx={{ width: '100%' }}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleReauthenticate}
              sx={{ fontWeight: 'bold', ml: 2 }}
            >
              Riautenticare
            </Button>
          </Box>
        }
      >
        <Typography variant="body1">
          {errorMessage}
        </Typography>
      </Alert>
    </Snackbar>
  );
};

export default TokenExpirationAlert;