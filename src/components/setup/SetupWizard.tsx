import React from 'react';
import { Box, Stepper, Step, StepLabel, Button, Typography, TextField, FormControl, FormHelperText, InputLabel, OutlinedInput, InputAdornment, IconButton, Alert } from '@mui/material';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const steps = [
  'Attivazione Licenza',
  'Informazioni Aziendali',
  'Integrazione WhatsApp',
  'Configurazione Google Calendar'
];

interface LicenseFeatures {
  whatsappIntegration: boolean;
  googleCalendarIntegration: boolean;
}

interface LicenseFile {
  key: string;
  expirationDate: string;
  features: LicenseFeatures;
}

interface BusinessInfo {
  businessName: string;
}

const API_BASE_URL = 'http://localhost:3001/api';

export const SetupWizard: React.FC = () => {
  const [activeStep, setActiveStep] = React.useState(0);
  const [setupComplete, setSetupComplete] = React.useState(false);
  const [licenseFeatures, setLicenseFeatures] = React.useState<LicenseFeatures | null>(null);
  const [businessInfo, setBusinessInfo] = React.useState<BusinessInfo>({ businessName: '' });
  const [licenseFile, setLicenseFile] = React.useState<LicenseFile | null>(null);
  const [licenseError, setLicenseError] = React.useState<string | null>(null);
  const navigate = useNavigate();

  const handleNext = () => {
    if (activeStep === 0 && !licenseFeatures) {
      return; // Prevent next if license is not validated
    }
    
    // Skip WhatsApp step if not enabled
    if (activeStep === 1 && licenseFeatures && !licenseFeatures.whatsappIntegration && !licenseFeatures.googleCalendarIntegration) {
      setActiveStep(steps.length);
      return;
    }
    
    // Skip Google Calendar step if not enabled
    if (activeStep === 2 && licenseFeatures && !licenseFeatures.whatsappIntegration && licenseFeatures.googleCalendarIntegration) {
      setActiveStep(3);
      return;
    }
    
    if (activeStep === 2 && licenseFeatures && licenseFeatures.whatsappIntegration && !licenseFeatures.googleCalendarIntegration) {
      setActiveStep(steps.length);
      return;
    }
    
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const formik = useFormik({
    initialValues: {
      licenseKey: '',
      businessName: '',
      whatsappBrowserPath: '',
      whatsappDataPath: '',
      googleClientId: '',
      googleClientSecret: '',
      googleRedirectUri: ''
    },
    validationSchema: () => {
      // Create validation schema based on current license features
      const hasWhatsApp = licenseFeatures?.whatsappIntegration || false;
      const hasGoogleCalendar = licenseFeatures?.googleCalendarIntegration || false;
      
      return Yup.object({
        businessName: Yup.string().required('Campo obbligatorio'),
        whatsappBrowserPath: Yup.string().when([], {
          is: () => hasWhatsApp,
          then: (schema) => schema.required('Campo obbligatorio')
        }),
        whatsappDataPath: Yup.string().when([], {
          is: () => hasWhatsApp,
          then: (schema) => schema.required('Campo obbligatorio')
        }),
        googleClientId: Yup.string().when([], {
          is: () => hasGoogleCalendar,
          then: (schema) => schema.required('Campo obbligatorio')
        }),
        googleClientSecret: Yup.string().when([], {
          is: () => hasGoogleCalendar,
          then: (schema) => schema.required('Campo obbligatorio')
        }),
        googleRedirectUri: Yup.string().when([], {
          is: () => hasGoogleCalendar,
          then: (schema) => schema.required('Campo obbligatorio')
        })
      });
    },
    validateOnMount: true,
    onSubmit: async (values) => {
      try {
        if (activeStep === 0) {
          if (licenseFile) {
            // Usa le informazioni dal file JSON della licenza
            setLicenseFeatures(licenseFile.features);
            formik.setFieldValue('licenseKey', licenseFile.key);
            // Avanza al passaggio successivo
            setActiveStep((prevActiveStep) => prevActiveStep + 1);
          } else {
            setLicenseError('Seleziona un file di licenza valido.');
          }
          return;
        }
        
        if (activeStep === steps.length - 1) {
          const response = await axios.post(`${API_BASE_URL}/setup/complete`, values);
          
          if (response.data.complete) {
            localStorage.setItem('setupComplete', 'true');
            setSetupComplete(true);
            setActiveStep(steps.length);
          }
        } else {
          if (activeStep === 0) {
            await axios.post(`${API_BASE_URL}/setup/test-db-connection`);
          }
          handleNext();
        }
      } catch (error) {
        const err = error as { response?: { data?: { message: string } }, message: string };
        alert(`Setup failed: ${err.response?.data?.message || err.message}. Please try again.`);
      }
    },
  });

  const goToDashboard = () => {
    localStorage.setItem('setupComplete', 'true');
    // Forza il reindirizzamento alla dashboard
    window.location.href = '/dashboard';
  };

  // Funzione per gestire il caricamento del file JSON della licenza
  const handleLicenseFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLicenseError(null);
    const file = event.target.files?.[0];
    if (!file) {
      setLicenseError('Nessun file selezionato');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const licenseData = JSON.parse(content) as LicenseFile;
        
        // Verifica che il file contenga i campi necessari
        if (!licenseData.key || !licenseData.expirationDate || !licenseData.features) {
          setLicenseError('Il file di licenza non è valido. Mancano campi obbligatori.');
          return;
        }
        
        setLicenseFile(licenseData);
        setLicenseFeatures(licenseData.features);
        // Imposta il valore della licenza nel form
        formik.setFieldValue('licenseKey', licenseData.key);
      } catch (error) {
        console.error('Errore durante la lettura del file di licenza:', error);
        setLicenseError('Il file selezionato non è un file JSON valido.');
      }
    };
    
    reader.onerror = () => {
      setLicenseError('Errore durante la lettura del file.');
    };
    
    reader.readAsText(file);
  };
  
  // Effetto per avanzare automaticamente quando il file di licenza è caricato
  React.useEffect(() => {
    if (activeStep === 0 && licenseFile) {
      // Abilita il pulsante Avanti quando il file di licenza è caricato
      // Non avanza automaticamente, ma permette all'utente di cliccare Avanti
    }
  }, [licenseFile, activeStep]);

  const renderStepContent = (step: number) => {
    // Mostra solo i passaggi abilitati dalla licenza
    const availableSteps = [
      true, // Attivazione licenza sempre mostrata
      true, // Informazioni aziendali sempre mostrate
      licenseFeatures?.whatsappIntegration ?? false,
      licenseFeatures?.googleCalendarIntegration ?? false
    ];

    if (!availableSteps[step]) {
      handleNext();
      return null;
    }

    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Attivazione Licenza
            </Typography>
            {licenseError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {licenseError}
              </Alert>
            )}
            {licenseFile ? (
              <Box sx={{ mb: 2 }}>
                <Alert severity="success">
                  File di licenza caricato con successo: {licenseFile.key}
                  <br />
                  Data di scadenza: {licenseFile.expirationDate}
                  <br />
                  Funzionalità: 
                  {licenseFile.features.whatsappIntegration ? ' WhatsApp,' : ''}
                  {licenseFile.features.googleCalendarIntegration ? ' Google Calendar' : ''}
                </Alert>
                {/* Il bottone Avanti è già presente nella parte inferiore del form */}
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <Button
                  variant="contained"
                  component="label"
                  fullWidth
                >
                  Seleziona File di Licenza
                  <input
                    type="file"
                    accept=".json"
                    hidden
                    onChange={handleLicenseFileUpload}
                  />
                </Button>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Seleziona il file JSON della licenza per attivare il software. Se non hai un file di licenza, contatta l'assistenza.
            </Typography>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Informazioni Aziendali
            </Typography>
            <TextField
              fullWidth
              id="businessName"
              name="businessName"
              label="Nome Azienda"
              value={formik.values.businessName}
              onChange={(e) => {
                formik.handleChange(e);
                setBusinessInfo({ businessName: e.target.value });
              }}
              error={formik.touched.businessName && Boolean(formik.errors.businessName)}
              helperText={formik.touched.businessName && formik.errors.businessName}
              margin="normal"
              placeholder="Nome della tua azienda"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Inserisci il nome della tua azienda che verrà utilizzato nei modelli di notifica e in altre comunicazioni.
            </Typography>
            {/* Il bottone Avanti è già presente nella parte inferiore del form */}
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Integrazione WhatsApp
            </Typography>
            <TextField
              fullWidth
              id="whatsappBrowserPath"
              name="whatsappBrowserPath"
              label="Percorso Browser Chrome"
              value={formik.values.whatsappBrowserPath}
              onChange={formik.handleChange}
              error={formik.touched.whatsappBrowserPath && Boolean(formik.errors.whatsappBrowserPath)}
              helperText={formik.touched.whatsappBrowserPath && formik.errors.whatsappBrowserPath}
              margin="normal"
              placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe"
            />
            <TextField
              fullWidth
              id="whatsappDataPath"
              name="whatsappDataPath"
              label="Percorso Dati WhatsApp"
              value={formik.values.whatsappDataPath}
              onChange={formik.handleChange}
              error={formik.touched.whatsappDataPath && Boolean(formik.errors.whatsappDataPath)}
              helperText={formik.touched.whatsappDataPath && formik.errors.whatsappDataPath}
              margin="normal"
              placeholder="C:\Users\Username\AppData\Local\SlabsLink\WhatsAppData"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Inserisci i percorsi necessari per l'integrazione con WhatsApp. Il percorso del browser Chrome è necessario per aprire WhatsApp Web, mentre il percorso dati è dove verranno salvati i dati di sessione.
            </Typography>
          </Box>
        );
      case 3:
        return (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Configurazione Google Calendar
            </Typography>
            <TextField
              fullWidth
              id="googleClientId"
              name="googleClientId"
              label="Google Client ID"
              value={formik.values.googleClientId}
              onChange={formik.handleChange}
              error={formik.touched.googleClientId && Boolean(formik.errors.googleClientId)}
              helperText={formik.touched.googleClientId && formik.errors.googleClientId}
              margin="normal"
            />
            <TextField
              fullWidth
              id="googleClientSecret"
              name="googleClientSecret"
              label="Google Client Secret"
              value={formik.values.googleClientSecret}
              onChange={formik.handleChange}
              error={formik.touched.googleClientSecret && Boolean(formik.errors.googleClientSecret)}
              helperText={formik.touched.googleClientSecret && formik.errors.googleClientSecret}
              margin="normal"
            />
            <TextField
              fullWidth
              id="googleRedirectUri"
              name="googleRedirectUri"
              label="URI di Reindirizzamento"
              value={formik.values.googleRedirectUri}
              onChange={formik.handleChange}
              error={formik.touched.googleRedirectUri && Boolean(formik.errors.googleRedirectUri)}
              helperText={formik.touched.googleRedirectUri && formik.errors.googleRedirectUri}
              margin="normal"
              placeholder="http://localhost:3000/auth/google/callback"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Inserisci le tue credenziali API Google per abilitare l'integrazione con Google Calendar. Puoi ottenerle dalla Google Cloud Console.
            </Typography>
            {/* Il bottone Avanti è già presente nella parte inferiore del form */}
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ width: '100%', p: 4 }}>
      <Stepper activeStep={activeStep}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Box sx={{ mt: 4 }}>
        {activeStep === steps.length ? (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              Configurazione Completata!
            </Typography>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Tutte le configurazioni sono state salvate. Ora puoi iniziare a utilizzare l'applicazione.
            </Typography>
            <Button 
              variant="contained" 
              color="primary"
              onClick={goToDashboard}
            >
              Vai alla Dashboard
            </Button>
          </Box>
        ) : (
          <form onSubmit={formik.handleSubmit}>
            {renderStepContent(activeStep)}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
              {activeStep !== 0 && (
                <Button onClick={handleBack} sx={{ mr: 1 }}>
                  Indietro
                </Button>
              )}
              {activeStep === 0 && (
                <Button
                  variant="contained"
                  type="button"
                  onClick={() => {
                    if (licenseFile) {
                      // Imposta le caratteristiche della licenza e avanza direttamente
                      setLicenseFeatures(licenseFile.features);
                      formik.setFieldValue('licenseKey', licenseFile.key);
                      setActiveStep(1);
                    } else {
                      setLicenseError('Seleziona un file di licenza valido.');
                    }
                  }}
                  disabled={!licenseFile}
                >
                  Avanti
                </Button>
              )}
              {activeStep !== 0 && activeStep < steps.length - 1 && (
                <Button
                  variant="contained"
                  type="button"
                  onClick={() => {
                    // Per lo step 1 (Informazioni Aziendali)
                    if (activeStep === 1) {
                      // Verifica se il campo businessName è valido
                      if (formik.values.businessName && !formik.errors.businessName) {
                        // Salva le informazioni aziendali e avanza direttamente
                        setBusinessInfo({ businessName: formik.values.businessName });
                        handleNext();
                      } else {
                        // Tocca il campo per mostrare l'errore se non è valido
                        formik.setFieldTouched('businessName', true, true);
                      }
                    } else {
                      // Per gli altri step, usa il comportamento normale
                      formik.handleSubmit();
                    }
                  }}
                >
                  Avanti
                </Button>
              )}
              {activeStep === steps.length - 1 && (
                <Button
                  variant="contained"
                  color="primary"
                  type="button"
                  onClick={() => formik.handleSubmit()}
                >
                  Completa Configurazione
                </Button>
              )}
            </Box>
          </form>
        )}
      </Box>
    </Box>
  );
};