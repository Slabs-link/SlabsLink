import { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3';
import { Appointment } from '../interfaces/appointment.interface';

export function convertToGoogleCalendarEvent(eventData: calendar_v3.Schema$Event) {
  return {
    summary: eventData.summary,
    description: eventData.description,
    start: {
      dateTime: eventData.start?.dateTime,
      timeZone: eventData.start?.timeZone
    },
    end: {
      dateTime: eventData.end?.dateTime,
      timeZone: eventData.end?.timeZone
    }
  };
}

export function convertToAppointment(eventData: calendar_v3.Schema$Event): Appointment {
  return {
    id: 0, // You may want to generate or pass a proper ID
    patient_name: eventData.summary || '',
    appointment_date: eventData.start?.dateTime ? new Date(eventData.start.dateTime).toISOString().split('T')[0] : '',
    appointment_time: eventData.start?.dateTime ? new Date(eventData.start.dateTime).toTimeString().split(' ')[0].substring(0, 5) : '',
    start_time: eventData.start?.dateTime || '',
    end_time: eventData.end?.dateTime || '',
    notes: eventData.description || '',
    google_calendar_event_id: eventData.id || null,
    synced: true,
    notification_sent: false,
    status: 'scheduled'
  };
}