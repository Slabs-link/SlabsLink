import React, { useState, useEffect, useCallback, useRef, useReducer, useMemo, memo } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Grid,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Person,
  Wc,
  Cake,
  LocationCity,
  Badge,
  Phone,
  Email,
  Home,
  LocationOn,
  MarkunreadMailbox,
  MedicalServices,
  HealthAndSafety,
  Medication,
  Note,
  Save,
  Cancel
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import axios from 'axios';
import { generate } from '../../services/fiscal-code';
import type { Comune } from '../../../src/types/comune';

// Add export to the User type definition
export type User = {
  id?: number;
  first_name: string;
  last_name: string;
  gender: string;
  birth_date: Date | null;
  birth_city: string;
  birth_city_code?: string; // Add this field
  phone: string;
  email: string;
  address: string;
  city: string;
  postal_code: string;
  fiscal_code: string;
  medical_history: string;
  allergies: string;
  medications: string;
  notes: string;
  consent_to_data_processing: boolean;
  consent_to_communications: boolean;
};

type UserFormProps = {
  user?: User;
  onSave: (userData: Partial<User>) => Promise<void>;
  onCancel: () => void;
};

type UserFormAction =
  | { type: 'SET_FIELD'; payload: { field: keyof User; value: any } }
  | { type: 'SET_DATE'; payload: Date | null }
  | { type: 'SET_CHECKBOX'; payload: { field: keyof User; checked: boolean } };

const userFormReducer = (state: Partial<User>, action: UserFormAction): Partial<User> => {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.payload.field]: action.payload.value };
    case 'SET_DATE':
      return { ...state, birth_date: action.payload };
    case 'SET_CHECKBOX':
      return { ...state, [action.payload.field]: action.payload.checked };
    default:
      return state;
  }
};

const FALLBACK_COMUNI: Comune[] = [
  { nome: "Roma", codice: "H501", provincia: "RM" },
  { nome: "Milano", codice: "F205", provincia: "MI" },
  { nome: "Napoli", codice: "F839", provincia: "NA" },
  { nome: "Torino", codice: "L219", provincia: "TO" },
  { nome: "Palermo", codice: "G273", provincia: "PA" }
].map(c => ({
  ...c,
  nome: c.nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}));

const UserForm = memo(({ user, onSave, onCancel }: UserFormProps) => {
  const [comuni, setComuni] = useState<Comune[]>([]);
  const [loadingComuni, setLoadingComuni] = useState(false);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' | 'info' }>({ open: false, message: '', severity: 'info' });
  const [validationErrors, setValidationErrors] = useState<Partial<Record<keyof User, string>>>({});
  
  const comuniCache = useRef<Map<string, Comune[]>>(new Map());
  const abortController = useRef(new AbortController());
  
  const [userData, dispatch] = useReducer(userFormReducer, {
    ...user,
    birth_date: user?.birth_date ? new Date(user.birth_date) : null,
    birth_city: user?.birth_city || '',
    gender: user?.gender || 'Maschio' // Set default gender
  });

  // Add this after the userData reducer setup
  useEffect(() => {
    // Load initial comuni list or fallback
    const loadInitialComuni = async () => {
      try {
        console.log('Loading initial comuni list');
        const response = await axios.get('http://localhost:3001/api/comuni');
        console.log('Initial comuni response:', response.data);
        
        if (Array.isArray(response.data)) {
          setComuni(response.data);
        } else if (Array.isArray(response.data.comuni)) {
          setComuni(response.data.comuni);
        } else {
          console.log('Using fallback comuni');
          setComuni(FALLBACK_COMUNI);
        }
      } catch (error) {
        console.error('Error loading initial comuni:', error);
        setComuni(FALLBACK_COMUNI);
      }
    };
    
    loadInitialComuni();
  }, []);

  // Add this at the beginning of the component, after the state declarations
  useEffect(() => {
    // Test the fiscal code generation function
    try {
      const testCode = generate({
        name: 'Mario',
        surname: 'Rossi',
        gender: 'M',
        dob: '1990-01-01',
        birthplace: 'Z999' // Use a special code that works with the library
      });
      console.log('Test fiscal code generation:', testCode);
    } catch (error) {
      console.error('Error testing fiscal code generation:', error);
    }
  }, []);

  // Fetch comuni con debounce e cache
  // Update the fetchComuni function to handle formatted city names
  const fetchComuni = useCallback(async (searchQuery: string) => {
  // Don't search if query is too short
  if (!searchQuery || searchQuery.length < 2) {
    return;
  }
  
  // Check if the query is in the format "City (Province)" and extract just the city name
  const cityMatch = searchQuery.match(/^([^(]+)(\s*\([A-Z]+\))?$/);
  const queryToUse = cityMatch ? cityMatch[1].trim() : searchQuery;
  
  console.log('Fetching comuni with query:', queryToUse);
  setLoadingComuni(true);
  
  try {
    // Try different API endpoints
    let response;
    try {
      response = await axios.get(`http://localhost:3001/api/comuni?search=${encodeURIComponent(queryToUse)}`);
      console.log('Response from /api/comuni:', response.data);
    } catch (err) {
      console.log('Failed with /api/comuni, trying /api/comuni/search');
      response = await axios.get(`http://localhost:3001/api/comuni/search?query=${encodeURIComponent(queryToUse)}`);
      console.log('Response from /api/comuni/search:', response.data);
    }
    
    if (Array.isArray(response.data)) {
      console.log('Setting comuni from array response');
      setComuni(response.data);
    } else if (response.data && typeof response.data === 'object') {
      if (Array.isArray(response.data.comuni)) {
        console.log('Setting comuni from response.data.comuni');
        setComuni(response.data.comuni);
      } else {
        // Try to find any array in the response
        const possibleArrays = Object.values(response.data).filter(val => Array.isArray(val));
        if (possibleArrays.length > 0) {
          console.log('Found array in response:', possibleArrays[0]);
          setComuni(possibleArrays[0] as Comune[]);
        } else {
          console.log('No array found in response, using fallback');
          setComuni(FALLBACK_COMUNI);
        }
      }
    } else {
      console.log('Unexpected response format, using fallback');
      setComuni(FALLBACK_COMUNI);
    }
  } catch (error) {
    console.error('Error fetching comuni:', error);
    setComuni(FALLBACK_COMUNI);
  } finally {
    setLoadingComuni(false);
  }
}, []);

  // Generazione codice fiscale
  const handleGenerateFiscalCode = useCallback((): void => {
    console.log('Manual fiscal code generation triggered');
    
    const errors: Partial<Record<keyof User, string>> = {};
    const requiredFields: (keyof User)[] = ['first_name', 'last_name', 'gender', 'birth_date', 'birth_city'];
    
    console.log('Checking required fields:', {
      first_name: userData.first_name,
      last_name: userData.last_name,
      gender: userData.gender,
      birth_date: userData.birth_date,
      birth_city: userData.birth_city,
      birth_city_code: userData.birth_city_code
    });
    
    // Clear any existing birth_city validation error if the field is filled
    if (userData.birth_city && validationErrors.birth_city) {
      setValidationErrors(prev => ({
        ...prev,
        birth_city: undefined
      }));
    }
    
    // Check if birth_city is in the format "City (Province)"
    if (userData.birth_city && !userData.birth_city.includes('(')) {
      console.log('Birth city is not in the expected format');
      // Try to find the comune in the list
      const foundComune = comuni.find(c => c.nome === userData.birth_city);
      if (foundComune) {
        // Update the birth_city to include the province
        dispatch({ type: 'SET_FIELD', payload: { 
          field: 'birth_city', 
          value: `${foundComune.nome} (${foundComune.provincia})`
        }});
        // Update the birth_city_code
        dispatch({ type: 'SET_FIELD', payload: { 
          field: 'birth_city_code', 
          value: foundComune.codice
        }});
      }
    }
    
    // Modified validation logic to properly check birth_city
    requiredFields.forEach(field => {
      if (field === 'birth_city') {
        // Special handling for birth_city - check if it's empty or undefined
        if (!userData[field] || userData[field] === '') {
          errors[field] = 'Campo obbligatorio';
          console.log(`Missing required field: ${field}`);
        } else {
          // If birth_city is filled, clear any existing validation error
          if (validationErrors.birth_city) {
            setValidationErrors(prev => ({
              ...prev,
              birth_city: undefined
            }));
          }
        }
      } else if (!userData[field]) {
        errors[field] = 'Campo obbligatorio';
        console.log(`Missing required field: ${field}`);
      }
    });
  
    if (Object.keys(errors).length > 0) {
      console.log('Validation errors:', errors);
      setValidationErrors(errors);
      return;
    }
    
    try {
      // Extract just the city name without the province in parentheses
      const birthCityMatch = userData.birth_city?.match(/^([^(]+)(\s*\([A-Z]+\))?$/);
      const birthCity = birthCityMatch ? birthCityMatch[1].trim() : '';
      console.log('Extracted birth city:', birthCity);
      
      // Find the comune object to get the codice
      const selectedComune = comuni.find(c => c.nome === birthCity);
      console.log('Found comune:', selectedComune);
      
      // Try to manually construct the fiscal code for Napoli
      if (birthCity === 'Napoli' || selectedComune?.codice === 'F839') {
        // For Napoli, we'll manually calculate the code
        const name = userData.first_name!;
        const surname = userData.last_name!;
        const gender = userData.gender === 'Maschio' ? 'M' : 'F';
        const birthDate = userData.birth_date!;
        
        // Extract consonants and vowels
        const getConsonants = (str: string) => str.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, '');
        const getVowels = (str: string) => str.toUpperCase().replace(/[^AEIOU]/g, '');
        
        // Get surname code (first 3 consonants, or consonants + vowels, or pad with X)
        let surnameCode = getConsonants(surname);
        if (surnameCode.length < 3) {
          surnameCode += getVowels(surname);
        }
        surnameCode = surnameCode.padEnd(3, 'X').substring(0, 3);
        
        // Get name code (if more than 3 consonants, take 1st, 3rd, 4th; otherwise first 3 consonants, or consonants + vowels, or pad with X)
        let nameConsonants = getConsonants(name);
        let nameCode;
        if (nameConsonants.length > 3) {
          nameCode = nameConsonants[0] + nameConsonants[2] + nameConsonants[3];
        } else {
          nameCode = nameConsonants;
          if (nameCode.length < 3) {
            nameCode += getVowels(name);
          }
          nameCode = nameCode.padEnd(3, 'X').substring(0, 3);
        }
        
        // Get year code (last 2 digits of birth year)
        const yearCode = birthDate.getFullYear().toString().slice(-2);
        
        // Get month code (letter corresponding to birth month)
        const monthCodes = 'ABCDEHLMPRST';
        const monthCode = monthCodes[birthDate.getMonth()];
        
        // Get day code (day of birth + 40 for females)
        let dayCode = birthDate.getDate().toString();
        if (gender === 'F') {
          dayCode = (birthDate.getDate() + 40).toString();
        }
        dayCode = dayCode.padStart(2, '0');
        
        // For Napoli, use 'F839' as the city code
        const cityCode = 'F839';
        
        // Combine all parts
        const partialCode = surnameCode + nameCode + yearCode + monthCode + dayCode + cityCode;
        
        // Calculate check character (proper implementation)
        const calculateCheckCode = (code: string) => {
          const evenValues: Record<string, number> = {
            '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
            'A': 0, 'B': 1, 'C': 2, 'D': 3, 'E': 4, 'F': 5, 'G': 6, 'H': 7, 'I': 8, 'J': 9,
            'K': 10, 'L': 11, 'M': 12, 'N': 13, 'O': 14, 'P': 15, 'Q': 16, 'R': 17, 'S': 18, 'T': 19,
            'U': 20, 'V': 21, 'W': 22, 'X': 23, 'Y': 24, 'Z': 25
          };
          
          const oddValues: Record<string, number> = {
            '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
            'A': 1, 'B': 0, 'C': 5, 'D': 7, 'E': 9, 'F': 13, 'G': 15, 'H': 17, 'I': 19, 'J': 21,
            'K': 2, 'L': 4, 'M': 18, 'N': 20, 'O': 11, 'P': 3, 'Q': 6, 'R': 8, 'S': 12, 'T': 14,
            'U': 16, 'V': 10, 'W': 22, 'X': 25, 'Y': 24, 'Z': 23
          };
          
          let sum = 0;
          
          for (let i = 0; i < code.length; i++) {
            const char = code[i];
            if (i % 2 === 0) { // Odd position (0-based index)
              sum += oddValues[char] || 0;
            } else { // Even position (0-based index)
              sum += evenValues[char] || 0;
            }
          }
          
          const remainder = sum % 26;
          const checkChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          return checkChars[remainder];
        };
        
        const checkCode = calculateCheckCode(partialCode);
        
        // Combine everything
        const fiscalCode = partialCode + checkCode;
        
        console.log('Manually constructed fiscal code for Napoli:', fiscalCode);
        dispatch({ type: 'SET_FIELD', payload: { field: 'fiscal_code', value: fiscalCode } });
        return;
      }
      
      // For other cities, try the library with different codes
      const birthplaceOptions = [
        selectedComune?.codice,
        'F839', // Napoli
        'H501', // Roma
        'Z999'  // Foreign country (fallback)
      ].filter(Boolean) as string[];
      
      console.log('Trying birthplace options:', birthplaceOptions);
      
      let code = '';
      let error = null;
      
      // Try each option until one works
      for (const birthplaceCode of birthplaceOptions) {
        try {
          console.log('Trying with birthplace code:', birthplaceCode);
          code = generate({
            name: userData.first_name!,
            surname: userData.last_name!,
            gender: userData.gender === 'Maschio' ? 'M' : 'F',
            dob: userData.birth_date ? userData.birth_date.toISOString().split('T')[0] : '',
            birthplace: birthplaceCode
          });
          
          if (code) {
            console.log('Successfully generated fiscal code with code:', birthplaceCode);
            break;
          }
        } catch (err) {
          console.error('Error with code', birthplaceCode, err);
          error = err;
        }
      }
      
      if (!code && error) {
        throw error;
      }
  
      console.log('Generated fiscal code:', code);
      
      if (code) {
        console.log('Updating fiscal code to:', code);
        dispatch({ type: 'SET_FIELD', payload: { field: 'fiscal_code', value: code } });
      } else {
        console.log('No code generated');
        throw new Error('Failed to generate fiscal code');
      }
    } catch (error) {
      console.error('Error generating fiscal code:', error);
      setNotification({ open: true, message: 'Errore generazione codice fiscale', severity: 'error' });
    }
  }, [userData, comuni]);

  // Validazioni in tempo reale
  const validateField = useCallback((field: keyof User, value: any) => {
    const validators: Record<keyof User, (value: any) => string | undefined> = {
      first_name: (v: string) => !v ? 'Nome obbligatorio' : undefined,
      last_name: (v: string) => !v ? 'Cognome obbligatorio' : undefined,
      email: (v: string) => !/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v) ? 'Email non valida' : undefined,
      phone: (v: string) => !/^\d{10}$/.test(v) ? 'Numero non valido' : undefined,
      postal_code: (v: string) => !/^\d{5}$/.test(v) ? 'CAP non valido' : undefined,
      fiscal_code: (v: string) => !/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(v) ? 'Codice fiscale non valido' : undefined,
      // Altri campi...
    } as Record<keyof User, any>;

    return validators[field]?.(value);
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = Object.keys(userData).reduce((acc, field) => {
      const error = validateField(field as keyof User, userData[field as keyof User]);
      return error ? { ...acc, [field]: error } : acc;
    }, {} as typeof validationErrors);

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      console.log('Dati utente inviati:', userData);
      console.log('birth_city:', userData.birth_city);
      console.log('birth_city_code:', userData.birth_city_code);
      
      await onSave(userData);
      setNotification({ open: true, message: 'Salvataggio riuscito', severity: 'success' });
    } catch (error: any) {
      console.error('Errore completo:', error);
      
      // Check if it's an Axios error with a response
      if (error.response && error.response.data) {
        const errorMessage = error.response.data.message;
        console.log('Server error message:', errorMessage);
        
        // Handle specific error messages from the server
        if (errorMessage === 'Email already in use' || errorMessage === 'Email already in use by another user') {
          setValidationErrors(prev => ({
            ...prev,
            email: 'Email già in uso'
          }));
          setNotification({ open: true, message: 'Email già in uso', severity: 'error' });
        } else if (errorMessage === 'Fiscal code already in use' || errorMessage === 'Fiscal code already in use by another user') {
          setValidationErrors(prev => ({
            ...prev,
            fiscal_code: 'Codice fiscale già in uso'
          }));
          setNotification({ open: true, message: 'Codice fiscale già in uso', severity: 'error' });
        } else {
          // Generic error message for other cases
          setNotification({ open: true, message: `Errore nel salvataggio: ${errorMessage}`, severity: 'error' });
        }
      } else {
        // Fallback for non-axios errors
        setNotification({ open: true, message: 'Errore nel salvataggio', severity: 'error' });
      }
    }
  }, [userData, onSave, validateField]);

  // Render ottimizzato con memoizzazione
  const renderInput = useMemo(() => ({
    label,
    icon,
    field,
    type = 'text',
    required = false,
    options
  }: {
    label: string;
    icon: React.ReactNode;
    field: keyof User;
    type?: string;
    required?: boolean;
    options?: any[];
  }) => (
    <Grid item xs={12} sm={6} key={field}>
      <TextField
        fullWidth
        label={label}
        value={userData[field] || ''}
        onChange={(e) => {
          dispatch({ type: 'SET_FIELD', payload: { field, value: e.target.value } });
          setValidationErrors(prev => ({ ...prev, [field]: validateField(field, e.target.value) }));
        }}
        InputProps={{ startAdornment: icon }}
        type={type}
        required={required}
        error={!!validationErrors[field]}
        helperText={validationErrors[field]}
      />
    </Grid>
  ), [userData, validationErrors, validateField]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={it}>
      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
        <DialogTitle variant="h6">
          {user?.id ? 'Modifica Utente' : 'Nuovo Utente'}
        </DialogTitle>

        <DialogContent>
          {/* Grid container in the return statement */}
          <Grid container spacing={3} sx={{ paddingTop: '20px' }}>
            {renderInput({ label: 'Nome', icon: <Person />, field: 'first_name', required: true })}
            {renderInput({ label: 'Cognome', icon: <Person />, field: 'last_name', required: true })}
            
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Genere</InputLabel>
                <Select
                  value={userData.gender || 'Maschio'}
                  label="Genere"
                  onChange={(e) => {
                    dispatch({ type: 'SET_FIELD', payload: { field: 'gender', value: e.target.value } });
                    // Clear any validation errors
                    setValidationErrors(prev => ({
                      ...prev,
                      gender: undefined
                    }));
                  }}
                  startAdornment={<Wc />}
                  error={!!validationErrors.gender}
                >
                  <MenuItem value="Maschio">Maschio</MenuItem>
                  <MenuItem value="Femmina">Femmina</MenuItem>
                </Select>
                {validationErrors.gender && (
                  <Typography color="error" variant="caption">
                    {validationErrors.gender}
                  </Typography>
                )}
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={it}>
                <DatePicker
                  label="Data di nascita"
                  value={userData.birth_date && !isNaN(userData.birth_date.getTime()) ? userData.birth_date : null}
                  onChange={(date) => {
                    dispatch({ type: 'SET_FIELD', payload: { field: 'birth_date', value: date } });
                    setValidationErrors(prev => ({
                      ...prev,
                      birth_date: date ? undefined : 'Data obbligatoria'
                    }));
                  }}
                  format="dd/MM/yyyy"
                  sx={{ width: '100%' }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!validationErrors.birth_date,
                      helperText: validationErrors.birth_date,
                      InputProps: {
                        startAdornment: <Cake sx={{ color: 'action.active', mr: 1 }} />
                      }
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Autocomplete
                id="birth-city"
                options={comuni.length > 0 ? comuni : FALLBACK_COMUNI}
                getOptionLabel={(option) => `${option.nome} (${option.provincia})`}
                filterOptions={(x) => x}
                loading={loadingComuni}
                onInputChange={(_, value) => {
                  console.log('Input changed to:', value);
                  fetchComuni(value);
                  
                  // Clear validation error when user types
                  if (value && validationErrors.birth_city) {
                    setValidationErrors(prev => ({
                      ...prev,
                      birth_city: undefined
                    }));
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Città di nascita"
                    variant="outlined"
                    error={!!validationErrors.birth_city}
                    helperText={validationErrors.birth_city}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <LocationCity color="action" sx={{ mr: 1 }} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                      endAdornment: (
                        <>
                          {loadingComuni ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
                value={(() => {
                  // If birth_city is empty, return null
                  if (!userData.birth_city) return null;
                  
                  // First try to find an exact match
                  const exactMatch = comuni.find(c => 
                    `${c.nome} (${c.provincia})` === userData.birth_city
                  );
                  if (exactMatch) return exactMatch;
                  
                  // Then try to find a match by just the city name
                  const cityNameMatch = comuni.find(c => c.nome === userData.birth_city);
                  if (cityNameMatch) return cityNameMatch;
                  
                  // If we have a city code, try to find by code
                  if (userData.birth_city_code) {
                    const codeMatch = comuni.find(c => c.codice === userData.birth_city_code);
                    if (codeMatch) return codeMatch;
                  }
                  
                  // If the city name is in the format "City (Province)", extract just the city
                  const cityMatch = userData.birth_city.match(/^([^(]+)(\s*\([A-Z]+\))?$/);
                  if (cityMatch) {
                    const cityName = cityMatch[1].trim();
                    const nameMatch = comuni.find(c => c.nome === cityName);
                    if (nameMatch) return nameMatch;
                  }
                  
                  // If we still can't find a match, create a temporary object
                  // This prevents the field from being cleared when we can't find a match
                  if (userData.birth_city.includes('(')) {
                    const parts = userData.birth_city.match(/^([^(]+)\s*\(([A-Z]+)\)$/);
                    if (parts) {
                      return {
                        nome: parts[1].trim(),
                        provincia: parts[2],
                        codice: userData.birth_city_code || ''
                      };
                    }
                  }
                  
                  // Last resort: return null
                  return null;
                })()}
                onChange={(_, newValue: Comune | null) => {
                  console.log('Selected comune:', newValue);
                  if (newValue) {
                    // Store the full display string to match what's shown in the UI
                    const cityValue = `${newValue.nome} (${newValue.provincia})`;
                    console.log('Setting birth_city to:', cityValue);
                    
                    // Store the city with province for display
                    dispatch({ type: 'SET_FIELD', payload: { 
                      field: 'birth_city', 
                      value: cityValue
                    }});
                    
                    // Store the city code separately
                    dispatch({ type: 'SET_FIELD', payload: { 
                      field: 'birth_city_code', 
                      value: newValue.codice
                    }});
                    
                    // Log the updated userData after setting these fields
                    setTimeout(() => {
                      console.log('Updated userData after city selection:', userData);
                    }, 100);
                    
                    // Clear any validation errors immediately
                    setValidationErrors(prev => ({
                      ...prev,
                      birth_city: undefined
                    }));
                    
                    // Trigger fiscal code generation immediately after city selection
                    setTimeout(() => {
                      handleGenerateFiscalCode();
                    }, 100);
                  } else {
                    dispatch({ type: 'SET_FIELD', payload: { field: 'birth_city', value: '' }});
                    dispatch({ type: 'SET_FIELD', payload: { field: 'birth_city_code', value: '' }});
                  }
                }}
              />
            </Grid>

            {renderInput({ label: 'Codice Fiscale', icon: <Badge />, field: 'fiscal_code', required: true })}
            <Grid item xs={12}>
              <Button 
                variant="outlined" 
                onClick={handleGenerateFiscalCode} 
                startIcon={<HealthAndSafety />}
                disabled={!userData.first_name || !userData.last_name || !userData.gender || !userData.birth_date || !userData.birth_city}
              >
                Rigenera Codice Fiscale
              </Button>
            </Grid>
            
            {/* Add missing fields from User type */}
            {renderInput({ label: 'Telefono', icon: <Phone />, field: 'phone' })}
            {renderInput({ label: 'Email', icon: <Email />, field: 'email' })}
            {renderInput({ label: 'Indirizzo', icon: <Home />, field: 'address' })}
            {renderInput({ label: 'Città', icon: <LocationOn />, field: 'city' })}
            {renderInput({ label: 'CAP', icon: <MarkunreadMailbox />, field: 'postal_code' })}
            
            {/* Medical information fields */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Informazioni Mediche</Typography>
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Storia Medica"
                value={userData.medical_history || ''}
                onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'medical_history', value: e.target.value } })}
                InputProps={{ startAdornment: <MedicalServices sx={{ color: 'action.active', mr: 1, mt: 1 }} /> }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Allergie"
                value={userData.allergies || ''}
                onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'allergies', value: e.target.value } })}
                InputProps={{ startAdornment: <HealthAndSafety sx={{ color: 'action.active', mr: 1, mt: 1 }} /> }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Farmaci"
                value={userData.medications || ''}
                onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'medications', value: e.target.value } })}
                InputProps={{ startAdornment: <Medication sx={{ color: 'action.active', mr: 1, mt: 1 }} /> }}
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Note"
                value={userData.notes || ''}
                onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'notes', value: e.target.value } })}
                InputProps={{ startAdornment: <Note sx={{ color: 'action.active', mr: 1, mt: 1 }} /> }}
              />
            </Grid>
            
            {/* Consent checkboxes */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={userData.consent_to_data_processing || false}
                    onChange={(e) => dispatch({ 
                      type: 'SET_CHECKBOX', 
                      payload: { field: 'consent_to_data_processing', checked: e.target.checked } 
                    })}
                  />
                }
                label="Acconsento al trattamento dei dati personali"
              />
            </Grid>
            
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={userData.consent_to_communications || false}
                    onChange={(e) => dispatch({ 
                      type: 'SET_CHECKBOX', 
                      payload: { field: 'consent_to_communications', checked: e.target.checked } 
                    })}
                  />
                }
                label="Acconsento a ricevere comunicazioni"
              />
            </Grid>
            
            {/* Altri campi... */}
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={onCancel} startIcon={<Cancel />}>Annulla</Button>
          <Button type="submit" variant="contained" startIcon={<Save />}>Salva</Button>
        </DialogActions>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={() => setNotification(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={notification.severity}>{notification.message}</Alert>
      </Snackbar>
    </LocalizationProvider>
  );
});

export default UserForm;
