import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Autocomplete,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { it } from 'date-fns/locale';
import axios from 'axios';

interface User {
  id: number;
  first_name: string;
  last_name: string;
  fiscal_code?: string;
}

interface AppointmentType {
  id: number;
  name: string;
  description?: string;
}

interface AppointmentFormData {
  id?: number;
  title: string;
  appointment_type_id: number | null;
  patient_id: number | null;
  date: Date | string | null;
  time: Date | string | null;
  duration: number;
  notes: string;
  status: 'scheduled' | 'completed' | 'cancelled';
}

// Helper types for the date and time pickers
type DatePickerValue = Date | null;
type TimePickerValue = Date | null;

interface AppointmentFormProps {
  appointment?: any;
  onSave: (appointmentData: AppointmentFormData) => void;
  onCancel: () => void;
}

const AppointmentForm: React.FC<AppointmentFormProps> = ({ appointment, onSave, onCancel }) => {
  const [formData, setFormData] = useState<AppointmentFormData>({
    title: '',
    appointment_type_id: null,
    patient_id: null,
    date: null,
    time: null,
    duration: 30,
    notes: '',
    status: 'scheduled'
  });
  
  const [users, setUsers] = useState<User[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Carica gli utenti per il dropdown
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await axios.get('http://localhost:3001/api/users');
        setUsers(response.data);
        
        // Se stiamo modificando un appuntamento esistente, popola il form dopo aver caricato gli utenti
        if (appointment) {
          // Assicurati che patient_id sia un numero
          const patientId = typeof appointment.patient_id === 'string' 
            ? parseInt(appointment.patient_id, 10) 
            : appointment.patient_id;
            
          setFormData({
            id: appointment.id,
            title: appointment.title,
            appointment_type_id: appointment.appointment_type_id || null,
            patient_id: patientId,
            date: (appointment.appointment_date || appointment.date) ? new Date(appointment.appointment_date || appointment.date) : null,
            time: (appointment.appointment_time || appointment.time) ? new Date(`2000-01-01T${appointment.appointment_time || appointment.time}`) : null,
            duration: appointment.duration,
            notes: appointment.notes || '',
            status: appointment.status
          });
          
          console.log('Appointment data loaded:', {
            id: appointment.id,
            patient_id: patientId,
            first_name: appointment.first_name,
            last_name: appointment.last_name
          });
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    
    // Carica i tipi di appuntamento per il dropdown
    const fetchAppointmentTypes = async () => {
      setLoadingTypes(true);
      try {
        const response = await axios.get('http://localhost:3001/api/appointment-types');
        setAppointmentTypes(response.data);
      } catch (error) {
        console.error('Error fetching appointment types:', error);
        // Fallback con tipi predefiniti in caso di errore
        setAppointmentTypes([
          { id: 1, name: 'Prima visita' },
          { id: 2, name: 'Visita di controllo' },
          { id: 3, name: 'Follow-up' }
        ]);
      } finally {
        setLoadingTypes(false);
      }
    };
  
    fetchUsers();
    fetchAppointmentTypes();
  }, [appointment]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSelectChange = (e: any) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  // Change this line from Patient to User
  const handlePatientChange = (event: any, newValue: User | null) => {
    setFormData(prev => ({
      ...prev,
      patient_id: newValue ? newValue.id : null
    }));
    
    // Clear error when field is edited
    if (errors.patient_id) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.patient_id;
        return newErrors;
      });
    }
  };
  
  const handleAppointmentTypeChange = (event: any) => {
    const { value } = event.target;
    const selectedType = appointmentTypes.find(type => type.id === value);
    
    setFormData(prev => ({
      ...prev,
      appointment_type_id: value,
      title: selectedType ? selectedType.name : prev.title
    }));
    
    // Clear error when field is edited
    if (errors.appointment_type_id) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.appointment_type_id;
        return newErrors;
      });
    }
  };

  // Funzioni per gestire i cambiamenti di data e ora
  const handleDateChange = (date: Date | null) => {
    setFormData(prev => ({ ...prev, date }));
    
    // Clear error when field is edited
    if (errors.date) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.date;
        return newErrors;
      });
    }
  };

  const handleTimeChange = (time: Date | null) => {
    setFormData(prev => ({ ...prev, time }));
    
    // Clear error when field is edited
    if (errors.time) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.time;
        return newErrors;
      });
    }
  };

  // Funzioni helper per convertire i valori di data e ora per i componenti DatePicker e TimePicker
  const getDatePickerValue = (date: Date | string | null): DatePickerValue => {
    if (!date) return null;
    return date instanceof Date ? date : new Date(date);
  };

  const getTimePickerValue = (time: Date | string | null): TimePickerValue => {
    if (!time) return null;
    if (time instanceof Date) return time;
    // Se è una stringa (formato HH:MM), crea un oggetto Date
    return new Date(`2000-01-01T${time}`);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.appointment_type_id) {
      newErrors.appointment_type_id = 'Seleziona un tipo di appuntamento';
    }
    
    if (!formData.patient_id) {
      newErrors.patient_id = 'Seleziona un utente';
    }
    
    if (!formData.date) {
      newErrors.date = 'La data è obbligatoria';
    }
    
    if (!formData.time) {
      newErrors.time = "L'ora è obbligatoria";
    }
    
    if (!formData.duration || formData.duration <= 0) {
      newErrors.duration = 'La durata deve essere maggiore di 0';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      // Format the data for API submission
      let timeString = '';
      if (formData.time) {
        // Check if time is a Date object before calling Date methods
        if (formData.time instanceof Date) {
          timeString = `${formData.time.getHours().toString().padStart(2, '0')}:${formData.time.getMinutes().toString().padStart(2, '0')}`;
        } else if (typeof formData.time === 'string') {
          // If it's already a string, use it directly
          timeString = formData.time;
        }
      }
      
      let dateString = '';
      if (formData.date) {
        // Check if date is a Date object before calling Date methods
        if (formData.date instanceof Date) {
          dateString = `${formData.date.getFullYear()}-${(formData.date.getMonth() + 1).toString().padStart(2, '0')}-${formData.date.getDate().toString().padStart(2, '0')}`;
        } else if (typeof formData.date === 'string') {
          // If it's already a string, use it directly
          dateString = formData.date;
        }
      }
      
      // Assicurati che il titolo sia impostato in base al tipo di appuntamento selezionato
      const selectedType = appointmentTypes.find(type => type.id === formData.appointment_type_id);
      const title = selectedType ? selectedType.name : formData.title;
      
      const appointmentData = {
        ...formData,
        title,
        date: dateString,
        time: timeString
      };
      
      onSave(appointmentData);
    }
  };

  return (
    <>
      <DialogContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={it}>
          <Box component="form" noValidate sx={{ mt: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth required error={!!errors.appointment_type_id}>
                  <InputLabel id="appointment-type-label">Tipo di appuntamento</InputLabel>
                  <Select
                    labelId="appointment-type-label"
                    value={formData.appointment_type_id || ''}
                    onChange={handleAppointmentTypeChange}
                    label="Tipo di appuntamento"
                    name="appointment_type_id"
                  >
                    {loadingTypes ? (
                      <MenuItem disabled>
                        <CircularProgress size={20} />
                        Caricamento...
                      </MenuItem>
                    ) : (
                      appointmentTypes.map((type) => (
                        <MenuItem key={type.id} value={type.id}>
                          {type.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {errors.appointment_type_id && (
                    <Box component="span" sx={{ color: 'error.main', fontSize: '0.75rem', mt: 0.5, ml: 1.5 }}>
                      {errors.appointment_type_id}
                    </Box>
                  )}
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Autocomplete
                  options={users}
                  getOptionLabel={(option) => {
                    const fiscalCode = option.fiscal_code ? ` - ${option.fiscal_code}` : '';
                    return `${option.first_name} ${option.last_name}${fiscalCode}`;
                  }}
                  loading={loading}
                  value={users.find(u => u.id === formData.patient_id) || null}
                  onChange={handlePatientChange}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Utente"
                      required
                      error={!!errors.patient_id}
                      helperText={errors.patient_id}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {loading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => {
                    // Mostra sempre il codice fiscale se disponibile
                    const fiscalCode = option.fiscal_code ? ` - ${option.fiscal_code}` : '';
                    return (
                      <li {...props} key={option.id}>
                        {option.first_name} {option.last_name}{fiscalCode}
                      </li>
                    );
                  }}
                />
              </Grid>
              
              
              <Grid item xs={12} sm={6}>
                <DatePicker
                  label="Data"
                  value={getDatePickerValue(formData.date)}
                  onChange={handleDateChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!errors.date,
                      helperText: errors.date
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TimePicker
                  label="Ora"
                  value={getTimePickerValue(formData.time)}
                  onChange={handleTimeChange}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      required: true,
                      error: !!errors.time,
                      helperText: errors.time
                    }
                  }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  name="duration"
                  label="Durata (minuti)"
                  type="number"
                  value={formData.duration}
                  onChange={handleInputChange}
                  fullWidth
                  required
                  error={!!errors.duration}
                  helperText={errors.duration}
                  InputProps={{ inputProps: { min: 1 } }}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel id="status-label">Stato</InputLabel>
                  <Select
                    labelId="status-label"
                    name="status"
                    value={formData.status}
                    onChange={handleSelectChange}
                    label="Stato"
                  >
                    <MenuItem value="scheduled">Programmato</MenuItem>
                    <MenuItem value="completed">Completato</MenuItem>
                    <MenuItem value="cancelled">Annullato</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  name="notes"
                  label="Note"
                  value={formData.notes}
                  onChange={handleInputChange}
                  fullWidth
                  multiline
                  rows={4}
                />
              </Grid>
            </Grid>
          </Box>
        </LocalizationProvider>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Annulla</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Salva
        </Button>
      </DialogActions>
    </>
  );
};

export default AppointmentForm;