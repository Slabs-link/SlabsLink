import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const GoogleAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();
  const isProcessing = useRef(false); // Aggiungi useRef per tracciare l'elaborazione

  useEffect(() => {
    const handleCallback = async () => {
      console.log('[GoogleAuthCallback] Esecuzione useEffect');
      if (isProcessing.current) {
        console.log('[GoogleAuthCallback] Elaborazione già in corso, uscita.');
        return; // Evita esecuzioni multiple
      }
      isProcessing.current = true; // Imposta il flag di elaborazione
      console.log('[GoogleAuthCallback] Avvio elaborazione callback...');

      try {
        // Estrai il codice di autorizzazione dall'URL
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        
        if (!code) {
          setStatus('error');
          setMessage('Codice di autorizzazione mancante nella risposta di Google');
          isProcessing.current = false; // Resetta il flag in caso di errore precoce
          return;
        }

        console.log(`[GoogleAuthCallback] Codice ricevuto: ${code.substring(0, 10)}...`);
        console.log('[GoogleAuthCallback] Invio richiesta al backend...');
        // Invia il codice al backend
        const response = await fetch(`http://localhost:3001/api/google-calendar/callback?code=${code}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        console.log(`[GoogleAuthCallback] Risposta ricevuta dal backend: ${response.status}`);

        const result = await response.json();

        if (!response.ok || !result.success) {
          console.error(`[GoogleAuthCallback] Errore dal backend: ${result.message || response.statusText}`);
          throw new Error(result.message || `Errore dal server: ${response.status} ${response.statusText}`);
        }

        // Autenticazione riuscita
        console.log('[GoogleAuthCallback] Autenticazione riuscita.');
        setStatus('success');
        setMessage(result.message || 'Autenticazione con Google Calendar completata con successo!');

        // Reindirizza alla pagina delle impostazioni dopo 2 secondi
        setTimeout(() => {
          // Naviga direttamente alla scheda calendario delle impostazioni
          navigate('/settings?tab=calendar&auth=success');
        }, 2000);
      } catch (error) {
        console.error('[GoogleAuthCallback] Errore durante il callback di autenticazione:', error);
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto durante l\'autenticazione';
        setMessage(errorMessage);
        // Opzionale: reindirizza alla pagina di errore o mostra un messaggio
        setTimeout(() => {
          navigate(`/settings?tab=calendar&auth=error&message=${encodeURIComponent(errorMessage)}`);
        }, 3000); // Reindirizza dopo 3 secondi in caso di errore
      } finally {
        // Anche se non strettamente necessario resettare qui perché il componente si smonta,
        // potrebbe essere utile in scenari futuri.
        // isProcessing.current = false; 
      }
    };

    handleCallback();
    // Rimuovi isProcessing.current dalle dipendenze se non vuoi che il reset lo faccia rieseguire
  }, [location, navigate]); 

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: 3,
        backgroundColor: '#f5f5f5'
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 500,
          width: '100%'
        }}
      >
        <Typography variant="h5" gutterBottom>
          Autenticazione Google Calendar
        </Typography>

        <Box sx={{ my: 4, textAlign: 'center' }}>
          {status === 'loading' && (
            <>
              <CircularProgress size={60} thickness={4} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                Elaborazione dell'autenticazione in corso...
              </Typography>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircleIcon color="success" sx={{ fontSize: 60 }} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                {message}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                Verrai reindirizzato alla pagina delle impostazioni...
              </Typography>
            </>
          )}

          {status === 'error' && (
            <>
              <ErrorIcon color="error" sx={{ fontSize: 60 }} />
              <Typography variant="body1" sx={{ mt: 2 }}>
                {message}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                Torna alla pagina delle impostazioni e riprova.
              </Typography>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default GoogleAuthCallback;