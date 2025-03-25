import React, { useEffect, useState } from 'react';
import { Alert, AlertTitle, Box, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface LicenseAlertProps {
  daysUntilExpiry?: number;
  isValid?: boolean;
  showRedirect?: boolean;
}

const API_BASE_URL = 'http://localhost:3001/api';

const LicenseAlert: React.FC<LicenseAlertProps> = ({ 
  daysUntilExpiry, 
  isValid, 
  showRedirect = true 
}) => {
  const navigate = useNavigate();
  const [licenseInfo, setLicenseInfo] = useState<{
    daysUntilExpiry: number;
    isValid: boolean;
  }>({ daysUntilExpiry: daysUntilExpiry || 0, isValid: isValid || false });

  useEffect(() => {
    // Se i valori sono passati come props, usali
    if (daysUntilExpiry !== undefined && isValid !== undefined) {
      setLicenseInfo({ daysUntilExpiry, isValid });
      return;
    }

    // Altrimenti, recupera le informazioni sulla licenza dal server
    const fetchLicenseInfo = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/settings/license`);
        if (response.data) {
          setLicenseInfo({
            daysUntilExpiry: response.data.daysUntilExpiry || 0,
            isValid: response.data.isValid || false
          });
        }
      } catch (error) {
        console.error('Errore nel recupero delle informazioni sulla licenza:', error);
        setLicenseInfo({ daysUntilExpiry: 0, isValid: false });
      }
    };

    fetchLicenseInfo();
  }, [daysUntilExpiry, isValid]);

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  // Se la licenza è valida e mancano più di 30 giorni alla scadenza, non mostrare nulla
  if (licenseInfo.isValid && licenseInfo.daysUntilExpiry > 30) {
    return null;
  }

  // Se la licenza è valida ma mancano meno di 30 giorni alla scadenza
  if (licenseInfo.isValid && licenseInfo.daysUntilExpiry <= 30) {
    return (
      <Box sx={{ mb: 2 }}>
        <Alert 
          severity="warning"
          action={
            showRedirect ? (
              <Button color="inherit" size="small" onClick={handleGoToSettings}>
                Aggiorna
              </Button>
            ) : null
          }
        >
          <AlertTitle>Licenza in scadenza</AlertTitle>
          La tua licenza scadrà tra {licenseInfo.daysUntilExpiry} giorni. Aggiorna la tua licenza per continuare a utilizzare tutte le funzionalità.
        </Alert>
      </Box>
    );
  }

  // Se la licenza non è valida (scaduta)
  return (
    <Box sx={{ mb: 2 }}>
      <Alert 
        severity="error"
        action={
          showRedirect ? (
            <Button color="inherit" size="small" onClick={handleGoToSettings}>
              Aggiorna ora
            </Button>
          ) : null
        }
      >
        <AlertTitle>Licenza scaduta</AlertTitle>
        La tua licenza è scaduta. Aggiorna la tua licenza per continuare a utilizzare l'applicazione.
      </Alert>
    </Box>
  );
};

export default LicenseAlert;