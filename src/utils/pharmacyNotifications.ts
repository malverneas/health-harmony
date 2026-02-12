import { supabase } from "@/integrations/supabase/client";

const statusMessages: Record<string, string> = {
  acknowledged: "We have received your prescription and are reviewing it.",
  in_stock: "[Prescription Update] Good news! Your medications are in stock. Please choose if you'd like pickup or delivery.",
  out_of_stock: "[Prescription Update] Some medications are currently out of stock. Please contact us.",
  preparing: "[Order Update] Your medicine is now being prepared.",
  ready: "[Order Update] Your medicine is ready! You can now collect it if you chose pickup.",
  out_for_delivery: "[Order Update] Your medicine is out for delivery with our courier.",
  fulfilled: "[Order Update] Your prescription order has been successfully completed.",
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
    const content = message.startsWith('[') ? message : `[Prescription Update] ${message}`;

    await supabase.from('messages').insert({
      sender_id: pharmacyUserId,
      recipient_id: patientId,
      content: content,
    });
  } catch (error) {
    console.error('Error sending prescription notification:', error);
  }
}

export async function sendPharmacyNotification(
  patientId: string,
  pharmacyId: string,
  type: 'pickup' | 'delivery',
  address: string | null = null
): Promise<void> {
  try {
    // Get pharmacy user_id
    const { data: pharmacy } = await supabase
      .from('pharmacies')
      .select('user_id')
      .eq('id', pharmacyId)
      .single();

    if (!pharmacy?.user_id) return;

    let content = `[New Order] A patient has chosen ${type} for their prescription.`;
    if (type === 'delivery' && address) {
      content += ` Location: ${address}`;
    }

    await supabase.from('messages').insert({
      sender_id: patientId,
      recipient_id: pharmacy.user_id,
      content: content,
    });
  } catch (error) {
    console.error('Error sending pharmacy notification:', error);
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
        status: 'pending',
      });
    }
  } catch (error) {
    console.error('Error creating/updating order:', error);
  }
}
