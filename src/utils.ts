/**
 * Utility functions for the SlabsLink application
 */

/**
 * Formats a date string or Date object into a localized Italian date string
 * @param dateString - The date to format (string or Date object)
 * @returns Formatted date string in Italian locale
 */
export const formatDate = (dateString: string | Date): string => {
  if (!dateString) return 'Data non disponibile';
  
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('it-IT', options);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Data non valida';
  }
};

/**
 * Translates appointment status from English to Italian
 * @param status - The status to translate
 * @returns Translated status string
 */
export const translateStatus = (status: string): string => {
  switch (status) {
    case 'scheduled':
      return 'Programmato';
    case 'completed':
      return 'Completato';
    case 'cancelled':
      return 'Annullato';
    default:
      return status;
  }
};