import emailjs from '@emailjs/browser';

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'your_service_id';
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'your_template_id';
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'your_public_key';

export interface ConsultationEmailData {
    to_email: string;
    to_name: string;
    doctor_name: string;
    consultation_type: string;
    scheduled_at: string;
    reason?: string;
}

export const sendConsultationConfirmationEmail = async (data: ConsultationEmailData) => {
    try {
        const templateParams = {
            to_email: data.to_email,
            to_name: data.to_name,
            doctor_name: data.doctor_name,
            consultation_type: data.consultation_type,
            scheduled_at: data.scheduled_at,
            reason: data.reason || 'No specific reason provided'
        };

        const response = await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            templateParams,
            PUBLIC_KEY
        );

        console.log('Email sent successfully:', response.status, response.text);
        return response;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw error;
    }
};
