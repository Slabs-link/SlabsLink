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
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
class WhatsAppService {
    constructor() {
        this.apiToken = process.env.WHATSAPP_API_TOKEN || '';
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        this.version = process.env.WHATSAPP_VERSION || 'v17.0';
        this.baseUrl = `https://graph.facebook.com/${this.version}/${this.phoneNumberId}`;
        // Check if WhatsApp is configured
        this.isConfigured = !!(this.apiToken && this.phoneNumberId);
        if (!this.isConfigured) {
            console.warn('WhatsApp Business API not fully configured. Running in simulation mode.');
        }
        else {
            console.log('WhatsApp Business API configured successfully.');
        }
    }
    /**
     * Send a WhatsApp message using the WhatsApp Business API
     * @param to Recipient's phone number (international format)
     * @param message Message text
     * @returns Promise with the result of the operation
     */
    sendMessage(to, message) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Format the phone number
                const formattedNumber = this.formatPhoneNumber(to);
                // If WhatsApp is not configured, simulate sending
                if (!this.isConfigured) {
                    console.log(`[SIMULATION] Sending WhatsApp message to ${formattedNumber}: ${message}`);
                    // Simulate 80% success rate
                    const success = Math.random() > 0.2;
                    if (!success) {
                        throw new Error('Simulated WhatsApp message failure');
                    }
                    return true;
                }
                // Prepare the request body for real WhatsApp API
                const data = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: formattedNumber,
                    type: 'text',
                    text: {
                        preview_url: false,
                        body: message
                    }
                };
                // Send the request to WhatsApp Business API
                const response = yield axios_1.default.post(`${this.baseUrl}/messages`, data, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiToken}`
                    }
                });
                console.log(`WhatsApp message sent to ${to}, response:`, response.data);
                return true;
            }
            catch (error) {
                console.error('Error sending WhatsApp message:', ((_a = error.response) === null || _a === void 0 ? void 0 : _a.data) || error.message);
                return false;
            }
        });
    }
    /**
     * Format phone number to international format
     * @param phoneNumber Phone number
     * @returns Formatted phone number
     */
    formatPhoneNumber(phoneNumber) {
        // Remove all non-numeric characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        // Make sure it starts with country code
        if (!cleaned.startsWith('39') && !cleaned.startsWith('+39')) {
            // If it doesn't have the international prefix, add +39 (Italy)
            // Change this if your users are from a different country
            cleaned = '39' + cleaned;
        }
        else if (cleaned.startsWith('+')) {
            // Remove the + if present
            cleaned = cleaned.substring(1);
        }
        return cleaned;
    }
    /**
     * Process a template message with variables
     * @param template Template content with placeholders
     * @param variables Object with variables to replace
     * @returns Processed message
     */
    processTemplate(template, variables) {
        let processedMessage = template;
        // Replace all variables in the format {{variable_name}}
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            processedMessage = processedMessage.replace(placeholder, value);
        }
        return processedMessage;
    }
}
// Export a singleton instance of the service
exports.default = new WhatsAppService();
