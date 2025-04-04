import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import axios from 'axios';

interface MedicalOfficeSettings {
  showInfoTab: boolean;
  userFilesPath: string;
}

const MedicalOfficeSettings: React.FC = () => {
  const [settings, setSettings] = useState<MedicalOfficeSettings>({
    showInfoTab: true,
    userFilesPath: 'uploads/users'
  });
  
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  const API_BASE_URL = 'http://localhost:3001/api';
  
  // Carica le impostazioni dello studio medico
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/settings/medical-office`);
        if (response.data) {
          setSettings({
            showInfoTab: response.data.showInfoTab !== undefined ? response.data.showInfoTab : true,
            userFilesPath: response.data.userFilesPath || 'uploads/users'
          });
        }
      } catch (error) {
        console.error('Errore durante il recupero delle impostazioni dello studio medico:', error);
        // In caso di errore, manteniamo i valori predefiniti
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  // Gestisce il cambiamento dei campi di input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | { name?: string; value: unknown }>) => {
    const { name, value } = e.target as { name: string; value: unknown };
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Gestisce il cambiamento degli switch
  const handleSwitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: checked
    }));
  };
  
  // Salva le impostazioni
  const handleSaveSettings = async () => {
    setLoading(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      // Invia i dati al server direttamente come JSON
      await axios.post(`${API_BASE_URL}/settings/medical-office`, settings, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Errore durante il salvataggio delle impostazioni:', error);
      setSaveError(error.response?.data?.message || 'Errore durante il salvataggio delle impostazioni');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>Impostazioni Studio Medico</Typography>
      <Divider sx={{ mb: 3 }} />
      
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Impostazioni salvate con successo!
        </Alert>
      )}
      
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Impostazioni Schede Utente
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.showInfoTab}
                    onChange={handleSwitchChange}
                    name="showInfoTab"
                    color="primary"
                  />
                }
                label="Mostra scheda Informazioni nei dettagli utente"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Percorso File Utenti"
                name="userFilesPath"
                value={settings.userFilesPath}
                onChange={handleInputChange}
                variant="outlined"
                margin="normal"
                helperText="Percorso relativo per i file degli utenti. Verrà creata una cartella per ogni utente."
              />
            </Grid>
            
            <Grid item xs={12} sx={{ mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSaveSettings}
                disabled={loading}
              >
                Salva Impostazioni
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default MedicalOfficeSettings;