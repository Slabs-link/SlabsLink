import React, { useState, useEffect } from 'react';
import { Button, Card, Divider, List, ListItem, ListItemText, ListItemSecondaryAction, Typography, Box, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Paper, IconButton, Stack, Alert, Snackbar, CircularProgress } from '@mui/material';
import { Backup as BackupIcon, Delete as DeleteIcon, Restore as RestoreIcon, Refresh as RefreshIcon } from '@mui/icons-material';
// Modifica l'importazione per utilizzare il servizio corretto
import { backupService } from '../../services/backup.service';

export const BackupSettings = () => {
  const [backups, setBackups] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error'}>({open: false, message: '', severity: 'success'});

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
  }, []);

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

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>Gestione Backup</Typography>
      
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