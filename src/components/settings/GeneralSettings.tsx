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
  CircularProgress
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import axios from 'axios';

interface GeneralSettingsProps {
  settings: {
    clinicName: string;
    address: string;
    phone: string;
    email: string;
    website: string;
  };
  onChange: (settings: any) => void;
  onSave?: () => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, onChange, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const API_BASE_URL = 'http://localhost:3001/api';

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_BASE_URL}/settings/general`);
        if (response.data) {
          let generalSettings;
          try {
            // Prima verifica se response.data.value esiste ed è una stringa
            if (response.data.value && typeof response.data.value === 'string') {
              generalSettings = JSON.parse(response.data.value);
            } else if (response.data.general) {
              // Se c'è un oggetto general, usa quello
              generalSettings = response.data.general;
            } else {
              // Altrimenti usa direttamente response.data
              generalSettings = response.data;
            }
          } catch (e) {
            console.error('Errore nel parsing delle impostazioni:', e);
            generalSettings = {};
          }
          const settings = {
            clinicName: generalSettings.clinicName || '',
            address: generalSettings.address || '',
            phone: generalSettings.phone || '',
            email: generalSettings.email || '',
            website: generalSettings.website || ''
          };
          console.log('Impostazioni generali caricate:', settings);
          onChange(settings);
        }
      } catch (error) {
        console.error('Errore durante il recupero delle impostazioni generali:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, []);
  
  
  const handleSaveSettings = async () => {
    if (onSave) {
      onSave();
      return;
    }
    
    setLoading(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      await axios.put(`${API_BASE_URL}/settings/general`, settings);
      
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error: any) {
      console.error('Errore durante il salvataggio delle impostazioni generali:', error);
      setSaveError(error.response?.data?.message || 'Errore durante il salvataggio delle impostazioni');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>Impostazioni Generali</Typography>
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
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome Attività"
                name="clinicName"
                value={settings.clinicName}
                onChange={(e) => onChange({ ...settings, clinicName: e.target.value })}
                variant="outlined"
                margin="normal"
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

export default GeneralSettings;