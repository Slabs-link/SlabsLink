import express from 'express';
import WhatsAppService from '../services/whatsapp.service';

const router = express.Router();

/**
 * Endpoint per inviare un messaggio WhatsApp
 * Questo endpoint viene chiamato dal frontend per inviare messaggi WhatsApp
 * utilizzando il servizio server-side che supporta Puppeteer
 */
router.post('/send', async (req, res) => {
  try {
    const { phoneNumber, message, autoSend = false } = req.body;
    
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Numero di telefono e messaggio sono obbligatori' 
      });
    }
    
    // Invia il messaggio WhatsApp utilizzando il servizio server-side
    // Il parametro autoSend determina se il messaggio deve essere inviato automaticamente
    // o se deve solo aprire la chat WhatsApp Web
    const success = await WhatsAppService.sendMessage(phoneNumber, message, autoSend);
    
    if (success) {
      return res.status(200).json({ 
        success: true, 
        message: 'Messaggio WhatsApp inviato con successo' 
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: 'Impossibile inviare il messaggio WhatsApp' 
      });
    }
  } catch (error) {
    console.error('Errore durante l\'invio del messaggio WhatsApp:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Errore durante l\'invio del messaggio WhatsApp', 
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;