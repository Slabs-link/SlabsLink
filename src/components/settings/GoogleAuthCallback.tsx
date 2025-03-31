import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Paper } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const GoogleAuthCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Estrai il codice di autorizzazione dall'URL
        const searchParams = new URLSearchParams(location.search);
        const code = searchParams.get('code');
        
        if (!code) {
          setStatus('error');
          setMessage('Codice di autorizzazione mancante nella risposta di Google');
          return;
        }

        // Invia il codice al backend
        const response = await fetch(`http://localhost:3001/api/google-calendar/callback?code=${code}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Errore durante l\'autenticazione con Google Calendar');
        }

        setStatus('success');
        setMessage('Autenticazione con Google Calendar completata con successo!');
        
        // Reindirizza alla pagina delle impostazioni dopo 2 secondi
        setTimeout(() => {
          navigate('/settings?tab=calendar&auth=success');
        }, 2000);
      } catch (error) {
        console.error('Errore durante il callback di autenticazione:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Errore sconosciuto durante l\'autenticazione');
      }
    };

    handleCallback();
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