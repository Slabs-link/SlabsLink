import React, { useRef, useState } from 'react';
import { Button, TextField, Box, Typography, InputAdornment } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import FileOpenIcon from '@mui/icons-material/FileOpen';

interface FileFolderPickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  accept?: string;
  isFolder?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  helperText?: string;
  error?: boolean;
}

/**
 * Componente per selezionare file o cartelle con un'interfaccia utente migliorata
 */
const FileFolderPicker: React.FC<FileFolderPickerProps> = ({
  value,
  onChange,
  label,
  placeholder,
  accept = '*.*',
  isFolder = false,
  disabled = false,
  fullWidth = true,
  helperText,
  error = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayValue, setDisplayValue] = useState<string>(value || '');

  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // In un'applicazione web standard, possiamo ottenere solo il nome del file, non il percorso completo
      // per motivi di sicurezza. In un'applicazione Electron, sarebbe possibile ottenere il percorso completo.
      const filePath = files[0].name;
      
      // Nota: in un'applicazione web, questo mostrerà solo il nome del file selezionato
      // e non il percorso completo per motivi di sicurezza del browser
      setDisplayValue(filePath);
      onChange(filePath);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setDisplayValue(newValue);
    onChange(newValue);
  };

  return (
    <Box sx={{ mb: 2 }}>
      <TextField
        label={label}
        value={displayValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        fullWidth={fullWidth}
        helperText={helperText}
        error={error}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <Button
                onClick={handleButtonClick}
                disabled={disabled}
                sx={{ minWidth: 'auto' }}
                title={isFolder ? 'Seleziona cartella' : 'Seleziona file'}
              >
                {isFolder ? <FolderOpenIcon /> : <FileOpenIcon />}
              </Button>
            </InputAdornment>
          ),
        }}
      />
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept={accept}
        // Il webkitdirectory è un attributo non standard supportato da Chrome, Edge e Firefox
        // che permette di selezionare cartelle invece di file
        {...(isFolder ? { webkitdirectory: '', directory: '' } : {})}
        disabled={disabled}
      />
      {isFolder && (
        <Typography variant="caption" color="text.secondary">
          Nota: La selezione di cartelle potrebbe non funzionare in tutti i browser. In caso di problemi, inserisci manualmente il percorso.
        </Typography>
      )}
    </Box>
  );
};

export default FileFolderPicker;