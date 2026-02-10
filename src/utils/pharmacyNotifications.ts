import { supabase } from "@/integrations/supabase/client";

const statusMessages: Record<string, string> = {
  acknowledged: "We have received your prescription and are reviewing it.",
  in_stock: "Good news! All medications in your prescription are in stock.",
  out_of_stock: "Unfortunately, some medications in your prescription are currently out of stock. Please contact us for alternatives.",
  preparing: "Your prescription is now being prepared. We'll notify you when it's ready.",
  ready: "Great news! Your prescription is ready for pickup at our pharmacy.",
  out_for_delivery: "Your prescription is out for delivery. You should receive it soon!",
  fulfilled: "Your prescription order has been completed. Thank you for choosing us!",
};

export async function sendPrescriptionStatusNotification(
  pharmacyUserId: string,
  patientId: string,
  prescriptionId: string,
  newStatus: string,
  pharmacyName: string
): Promise<void> {
  const message = statusMessages[newStatus];
  if (!message) return;

  try {
    const content = `[Prescription Update] ${message}`;
    
    await supabase.from('messages').insert({
      sender_id: pharmacyUserId,
      recipient_id: patientId,
      content: content,
    });
  } catch (error) {
    console.error('Error sending prescription notification:', error);
  }
}

export async function createOrderFromPrescription(
  prescriptionId: string,
  patientId: string,
  pharmacyId: string,
  deliveryType: 'pickup' | 'delivery' = 'pickup'
): Promise<void> {
  try {
    // Check if order already exists for this prescription
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('prescription_id', prescriptionId)
      .single();

    if (existingOrder) {
      // Update existing order status
      await supabase
        .from('orders')
        .update({ status: 'delivered' })
        .eq('id', existingOrder.id);
    } else {
      // Create new order
      await supabase.from('orders').insert({
        prescription_id: prescriptionId,
        patient_id: patientId,
        pharmacy_id: pharmacyId,
        delivery_type: deliveryType,
        status: 'delivered',
      });
    }
  } catch (error) {
    console.error('Error creating/updating order:', error);
  }
}
