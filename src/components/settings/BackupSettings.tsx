import React, { useState, useEffect } from 'react';
import { Button, Card, Divider, List, ListItem, ListItemText, ListItemSecondaryAction, Typography, Box, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Paper, IconButton, Stack, Alert, Snackbar, CircularProgress, Switch, FormControlLabel, TextField, Grid } from '@mui/material';
import { Backup as BackupIcon, Delete as DeleteIcon, Restore as RestoreIcon, Refresh as RefreshIcon, Schedule as ScheduleIcon, Folder as FolderIcon } from '@mui/icons-material';
// Modifica l'importazione per utilizzare il servizio corretto
import { backupService } from '../../services/backup.service';
import axios from 'axios';
import FileFolderPicker from '../common/FileFolderPicker';

export const BackupSettings = () => {
  const [backups, setBackups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error'}>({open: false, message: '', severity: 'success'});
  
  // Stato per il backup automatico
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [backupFrequency, setBackupFrequency] = useState<number>(24); // Ore
  const [maxBackups, setMaxBackups] = useState<number>(10); // Numero massimo di backup da mantenere
  const [backupPath, setBackupPath] = useState<string>(''); // Percorso personalizzato per i backup
  const [autoBackupLoading, setAutoBackupLoading] = useState(false);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const response = await backupService.getBackups();
      setBackups(response.data);
    } catch (err) {
      setSnackbar({open: true, message: 'Errore nel caricamento dei backup', severity: 'error'});
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
    loadAutoBackupSettings();
  }, []);
  
  // Carica le impostazioni del backup automatico
  const loadAutoBackupSettings = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/settings/auto-backup');
      if (response.data) {
        setAutoBackupEnabled(response.data.enabled || false);
        setBackupFrequency(response.data.frequency || 24);
        setMaxBackups(response.data.maxBackups || 10);
        setBackupPath(response.data.backupPath || '');
      }
    } catch (err) {
      console.error('Errore nel caricamento delle impostazioni di backup automatico:', err);
    }
  };

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await backupService.createBackup();
      setSnackbar({open: true, message: 'Backup creato con successo', severity: 'success'});
      await loadBackups();
    } catch (err) {
      setSnackbar({open: true, message: 'Errore nella creazione del backup', severity: 'error'});
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    
    setRestoreLoading(true);
    try {
      await backupService.restoreBackup(selectedBackup);
      setSnackbar({open: true, message: 'Backup ripristinato con successo', severity: 'success'});
    } catch (err) {
      setSnackbar({open: true, message: 'Errore nel ripristino del backup', severity: 'error'});
      console.error(err);
    } finally {
      setRestoreLoading(false);
      setConfirmVisible(false);
    }
  };

  const handleDeleteBackup = async (backup: string) => {
    setDeleteLoading(true);
    try {
      await backupService.deleteBackup(backup);
      setSnackbar({open: true, message: 'Backup eliminato con successo', severity: 'success'});
      await loadBackups();
    } catch (err) {
      setSnackbar({open: true, message: 'Errore nell\'eliminazione del backup', severity: 'error'});
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const showConfirm = () => {
    if (!selectedBackup) return;
    setConfirmVisible(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbar({...snackbar, open: false});
  };
  
  // Gestisce il salvataggio delle impostazioni di backup automatico
  const handleSaveAutoBackupSettings = async () => {
    setAutoBackupLoading(true);
    try {
      await backupService.saveAutoBackupSettings({
        enabled: autoBackupEnabled,
        frequency: backupFrequency,
        maxBackups: maxBackups,
        backupPath: backupPath
      });
      setSnackbar({open: true, message: 'Impostazioni di backup automatico salvate con successo', severity: 'success'});
    } catch (err) {
      setSnackbar({open: true, message: 'Errore nel salvataggio delle impostazioni di backup automatico', severity: 'error'});
      console.error(err);
    } finally {
      setAutoBackupLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Gestione Backup</Typography>
      
      {/* Sezione Backup Automatico */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>Backup Automatico</Typography>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={autoBackupEnabled}
                    onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Abilita backup automatico"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Frequenza di backup (ore)"
                type="number"
                value={backupFrequency}
                onChange={(e) => setBackupFrequency(parseInt(e.target.value))}
                disabled={!autoBackupEnabled}
                InputProps={{ inputProps: { min: 1, max: 168 } }}
                helperText="Minimo 1 ora, massimo 168 ore (7 giorni)"
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Numero massimo di backup da mantenere"
                type="number"
                value={maxBackups}
                onChange={(e) => setMaxBackups(parseInt(e.target.value))}
                disabled={!autoBackupEnabled}
                InputProps={{ inputProps: { min: 1, max: 100 } }}
                helperText="I backup più vecchi verranno eliminati automaticamente"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FileFolderPicker
                label="Cartella di destinazione dei backup"
                value={backupPath}
                onChange={setBackupPath}
                isFolder={true}
                directoryOnly={true}
                disabled={!autoBackupEnabled}
                helperText="Seleziona la cartella dove salvare i backup"
                placeholder="Seleziona una cartella..."
              />
            </Grid>
            
            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<ScheduleIcon />}
                onClick={handleSaveAutoBackupSettings}
                disabled={autoBackupLoading}
              >
                {autoBackupLoading ? <CircularProgress size={24} /> : 'Salva Impostazioni'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      </Box>
      
      <Divider sx={{ my: 3 }} />
      
      <Typography variant="h6" gutterBottom>Backup Manuale</Typography>
      
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<BackupIcon />}
          disabled={loading}
          onClick={handleCreateBackup}
        >
          {loading ? <CircularProgress size={24} /> : 'Crea Backup'}
        </Button>
      </Box>

      <Divider sx={{ my: 2 }} />

      <Typography variant="h6" gutterBottom>Backup disponibili</Typography>
      
      <Stack direction="row" spacing={2} sx={{ mb: 3, alignItems: 'center' }}>
        <FormControl sx={{ minWidth: 300 }}>
          <InputLabel id="backup-select-label">Seleziona un backup</InputLabel>
          <Select
            labelId="backup-select-label"
            value={selectedBackup}
            onChange={(e) => setSelectedBackup(e.target.value)}
            label="Seleziona un backup"
            disabled={loading}
          >
            {backups.map(backup => (
              <MenuItem key={backup} value={backup}>
                {backup}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<RestoreIcon />}
          disabled={!selectedBackup || restoreLoading}
          onClick={showConfirm}
        >
          {restoreLoading ? <CircularProgress size={24} /> : 'Ripristina'}
        </Button>
        
        <IconButton 
          color="primary" 
          onClick={loadBackups} 
          disabled={loading}
        >
          <RefreshIcon />
        </IconButton>
      </Stack>

      <Paper variant="outlined" sx={{ maxHeight: 300, overflow: 'auto' }}>
        <List>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
              <CircularProgress />
            </Box>
          ) : backups.length === 0 ? (
            <ListItem>
              <ListItemText primary="Nessun backup disponibile" />
            </ListItem>
          ) : (
            backups.map(backup => (
              <ListItem key={backup}>
                <ListItemText primary={backup} />
                <ListItemSecondaryAction>
                  <IconButton 
                    edge="end" 
                    color="error" 
                    onClick={() => handleDeleteBackup(backup)}
                    disabled={deleteLoading}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </Paper>

      <Dialog
        open={confirmVisible}
        onClose={() => setConfirmVisible(false)}
      >
        <DialogTitle>Conferma ripristino</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sei sicuro di voler ripristinare il backup {selectedBackup}? Questa operazione sovrascriverà il database corrente.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmVisible(false)}>Annulla</Button>
          <Button onClick={handleRestoreBackup} color="primary" variant="contained" disabled={restoreLoading}>
            {restoreLoading ? <CircularProgress size={24} /> : 'Ripristina'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};