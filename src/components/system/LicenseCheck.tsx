import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import LicenseAlert from './LicenseAlert';

interface LicenseCheckProps {
  children: React.ReactNode;
}

const API_BASE_URL = 'http://localhost:3001/api';

const LicenseCheck: React.FC<LicenseCheckProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLicenseValid, setIsLicenseValid] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [licenseInfo, setLicenseInfo] = useState({
    daysUntilExpiry: 0,
    isValid: false
  });

  useEffect(() => {
    const checkLicense = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/license`);
        
        if (response.data) {
          setLicenseInfo({
            daysUntilExpiry: response.data.daysUntilExpiry || 0,
            isValid: response.data.isValid || false
          });
          setIsLicenseValid(response.data.isValid);
        } else {
          setIsLicenseValid(false);
        }
      } catch (error) {
        console.error('Errore nel controllo della licenza:', error);
        setIsLicenseValid(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkLicense();
  }, []);

  // Se stiamo già nella pagina delle impostazioni o nella pagina di setup, mostra il contenuto normalmente
  if (location.pathname === '/settings' || location.pathname === '/setup') {
    return (
      <>
        {location.pathname === '/settings' && <LicenseAlert daysUntilExpiry={licenseInfo.daysUntilExpiry} isValid={licenseInfo.isValid} showRedirect={false} />}
        {children}
      </>
    );
  }

  // Se stiamo caricando, mostra un messaggio di caricamento
  if (isLoading) {
    return <div>Verifica licenza in corso...</div>;
  }

  // Se la licenza non è valida, reindirizza alla pagina delle impostazioni
  if (!isLicenseValid) {
    navigate('/settings');
    return null;
  }

  // Se la licenza è valida, mostra il contenuto normalmente
  return <>{children}</>;
};

export default LicenseCheck;