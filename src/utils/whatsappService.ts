/**
 * Green-API WhatsApp Service
 * 
 * To use this service, you need:
 * 1. idInstance (e.g., 1101000001)
 * 2. apiTokenInstance (e.g., d7f1... )
 */

const ID_INSTANCE = import.meta.env.VITE_GREEN_API_ID_INSTANCE;
const API_TOKEN_INSTANCE = import.meta.env.VITE_GREEN_API_TOKEN_INSTANCE;
const BASE_URL = 'https://api.green-api.com';

export interface WhatsAppNotificationData {
    phone: string;
    patientName: string;
    doctorName: string;
    consultationType: string;
    scheduledAt: string;
    vitals?: {
        temperature?: string;
        bloodPressure?: string;
        sugarLevel?: string;
    };
}

/**
 * Sends a WhatsApp notification via Green-API
 */
export const sendWhatsAppNotification = async (data: WhatsAppNotificationData) => {
    if (!ID_INSTANCE || !API_TOKEN_INSTANCE) {
        console.warn('WhatsApp notification skipped: Green-API credentials not configured in .env');
        return;
    }

    // Green-API requires phone numbers in format: 12345678901@c.us
    // We strip the '+' and any spaces/dashes
    const cleanPhone = data.phone.replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;

    let vitalsSection = '';
    if (data.vitals) {
        vitalsSection = `\n\n🩺 *Vitals provided:*`;
        if (data.vitals.temperature) vitalsSection += `\n- Temp: ${data.vitals.temperature}°C`;
        if (data.vitals.bloodPressure) vitalsSection += `\n- BP: ${data.vitals.bloodPressure}`;
        if (data.vitals.sugarLevel) vitalsSection += `\n- Sugar: ${data.vitals.sugarLevel} mmol/L`;
    }

    const message = `Hello ${data.patientName}! 👋\n\nYour ${data.consultationType} consultation with Dr. ${data.doctorName} has been successfully booked for:\n\n📅 ${data.scheduledAt}${vitalsSection}\n\nThank you for using Health Harmony!`;

    try {
        const response = await fetch(`${BASE_URL}/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chatId: chatId,
                message: message,
            }),
        });

        const result = await response.json();

        if (response.ok) {
            console.log('WhatsApp notification sent successfully:', result);
            return result;
        } else {
            console.error('Failed to send WhatsApp notification:', result);
            throw new Error(result.message || 'Failed to send WhatsApp notification');
        }
    } catch (error) {
        console.error('Error sending WhatsApp notification:', error);
        // We don't throw here to avoid breaking the booking flow if notification fails
        return null;
    }
};

/**
 * Sends a high vitals alert to a doctor
 */
export const sendDoctorVitalsAlert = async (doctorPhone: string, doctorName: string, patientName: string, vitals: { bp?: string, sugar?: string }) => {
    if (!ID_INSTANCE || !API_TOKEN_INSTANCE) return;

    const cleanPhone = doctorPhone.replace(/\D/g, '');
    const chatId = `${cleanPhone}@c.us`;

    const message = `🚨 *URGENT: High Vitals Alert* 🚨\n\nDr. ${doctorName}, patient *${patientName}* has just booked an appointment with concerning vitals:\n\n${vitals.bp ? `📈 *BP:* ${vitals.bp}\n` : ''}${vitals.sugar ? `🩸 *Sugar:* ${vitals.sugar} mmol/L\n` : ''}\nPlease review this case in your dashboard.`;

    try {
        await fetch(`${BASE_URL}/waInstance${ID_INSTANCE}/sendMessage/${API_TOKEN_INSTANCE}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId, message }),
        });
    } catch (error) {
        console.error('Error sending doctor alert:', error);
    }
};
