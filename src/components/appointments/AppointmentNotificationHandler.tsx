import React from 'react';
import { notificationService } from '../../services/notification.service';

interface AppointmentNotificationHandlerProps {
  appointmentId: number;
  notificationType: 'creation' | 'update' | 'cancellation';
  onSuccess?: () => void;
  onError?: (error: any) => void;
}

/**
 * Componente per gestire l'invio automatico di notifiche per gli eventi degli appuntamenti
 * Questo componente non ha UI, ma gestisce solo la logica di invio delle notifiche
 */
const AppointmentNotificationHandler: React.FC<AppointmentNotificationHandlerProps> = ({
  appointmentId,
  notificationType,
  onSuccess,
  onError
}) => {
  React.useEffect(() => {
    const sendNotification = async () => {
      try {
        await notificationService.sendAppointmentNotification(appointmentId, notificationType);
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error(`Error sending ${notificationType} notification for appointment ${appointmentId}:`, error);
        if (onError) onError(error);
      }
    };

    sendNotification();
  }, [appointmentId, notificationType, onSuccess, onError]);

  // Questo componente non renderizza nulla
  return null;
};

export default AppointmentNotificationHandler;