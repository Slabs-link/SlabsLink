"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const twilio_1 = __importDefault(require("twilio"));
const dotenv_1 = __importDefault(require("dotenv"));
// Carica le variabili d'ambiente
dotenv_1.default.config();
class TwilioService {
    constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        this.whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER || '';
        if (!accountSid || !authToken) {
            console.error('Twilio credentials not found in environment variables');
            throw new Error('Twilio credentials not configured');
        }
        this.client = (0, twilio_1.default)(accountSid, authToken);
    }
    /**
     * Invia un messaggio WhatsApp tramite Twilio
     * @param to Numero di telefono del destinatario (formato internazionale)
     * @param message Testo del messaggio
     * @returns Promise con il risultato dell'invio
     */
    sendWhatsAppMessage(to, message) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Formatta il numero di telefono
                const formattedNumber = this.formatPhoneNumber(to);
                // Prepara il numero di destinazione in formato WhatsApp
                const toWhatsApp = `whatsapp:${formattedNumber}`;
                // Invia il messaggio
                const result = yield this.client.messages.create({
                    body: message,
                    from: this.whatsappNumber,
                    to: toWhatsApp
                });
                console.log(`WhatsApp message sent to ${to}, SID: ${result.sid}`);
                return true;
            }
            catch (error) {
                console.error('Error sending WhatsApp message:', error);
                return false;
            }
        });
    }
    /**
     * Formatta il numero di telefono in formato internazionale
     * @param phoneNumber Numero di telefono
     * @returns Numero formattato
     */
    formatPhoneNumber(phoneNumber) {
        // Rimuovi tutti i caratteri non numerici
        let cleaned = phoneNumber.replace(/\D/g, '');
        // Assicurati che inizi con +
        if (!cleaned.startsWith('+')) {
            // Se non ha il prefisso internazionale, aggiungi +39 (Italia)
            // Modifica questo se i tuoi utenti sono di un altro paese
            if (!cleaned.startsWith('39')) {
                cleaned = '+39' + cleaned;
            }
            else {
                cleaned = '+' + cleaned;
            }
        }
        return cleaned;
    }
}
// Esporta un'istanza singleton del servizio
exports.default = new TwilioService();
