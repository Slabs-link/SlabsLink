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
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({
      ...settings,
      [name]: value
    });
  };
  
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
            <Grid item xs={12}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Informazioni Studio/Azienda
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Nome Studio/Azienda"
                name="clinicName"
                value={settings.clinicName}
                onChange={handleInputChange}
                variant="outlined"
                margin="normal"
                required
                helperText="Questo nome verrà utilizzato nelle notifiche al posto di 'SlabsLink'"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Indirizzo"
                name="address"
                value={settings.address}
                onChange={handleInputChange}
                variant="outlined"
                margin="normal"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Telefono"
                name="phone"
                value={settings.phone}
                onChange={handleInputChange}
                variant="outlined"
                margin="normal"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                value={settings.email}
                onChange={handleInputChange}
                variant="outlined"
                margin="normal"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Sito Web"
                name="website"
                value={settings.website}
                onChange={handleInputChange}
                variant="outlined"
                margin="normal"
              />
            </Grid>
            
            {!onSave && (
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
            )}
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default GeneralSettings;