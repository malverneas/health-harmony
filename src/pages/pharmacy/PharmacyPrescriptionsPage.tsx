import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FileText, Check, X, Loader2, Pill, Package, MapPin } from "lucide-react";
import { format } from "date-fns";
import { sendPrescriptionStatusNotification, createOrderFromPrescription } from "@/utils/pharmacyNotifications";

interface PrescriptionItem {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  createdAt: Date;
  status: string;
  items: PrescriptionItem[];
  pharmacyId: string;
  fulfillmentType: string | null;
  deliveryAddress: string | null;
}

const statusColors: Record<string, string> = {
  sent: "bg-blue-500/20 text-blue-400",
  acknowledged: "bg-yellow-500/20 text-yellow-400",
  in_stock: "bg-green-500/20 text-green-400",
  out_of_stock: "bg-red-500/20 text-red-400",
  preparing: "bg-orange-500/20 text-orange-400",
  ready: "bg-emerald-500/20 text-emerald-400",
  out_for_delivery: "bg-purple-500/20 text-purple-400",
  fulfilled: "bg-green-500/20 text-green-400",
};

export default function PharmacyPrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPrescriptions = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // First get the pharmacy for this user
      const { data: pharmacyData, error: pharmacyError } = await supabase
        .from('pharmacies')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (pharmacyError || !pharmacyData) {
        console.error('No pharmacy found for user');
        setPrescriptions([]);
        setIsLoading(false);
        return;
      }

      // Fetch prescriptions assigned to this pharmacy
      const { data: prescriptionsData, error: prescriptionsError } = await supabase
        .from('prescriptions')
        .select('id, patient_id, doctor_id, status, created_at, fulfillment_type, delivery_address')
        .eq('pharmacy_id', pharmacyData.id)
        .neq('status', 'pending_patient')
        .order('created_at', { ascending: false });

      if (prescriptionsError) throw prescriptionsError;

      if (!prescriptionsData || prescriptionsData.length === 0) {
        setPrescriptions([]);
        setIsLoading(false);
        return;
      }

      // Fetch patient and doctor profiles
      const patientIds = [...new Set(prescriptionsData.map(p => p.patient_id))];
      const doctorIds = [...new Set(prescriptionsData.map(p => p.doctor_id))];
      const allUserIds = [...new Set([...patientIds, ...doctorIds])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', allUserIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

      // Fetch prescription items
      const prescriptionIds = prescriptionsData.map(p => p.id);
      const { data: items } = await supabase
        .from('prescription_items')
        .select('*')
        .in('prescription_id', prescriptionIds);

      const itemsMap = new Map<string, PrescriptionItem[]>();
      items?.forEach(item => {
        const existing = itemsMap.get(item.prescription_id) || [];
        existing.push(item);
        itemsMap.set(item.prescription_id, existing);
      });

      // Build the final prescriptions array
      const formattedPrescriptions: Prescription[] = prescriptionsData.map(p => ({
        id: p.id,
        patientId: p.patient_id,
        patientName: profileMap.get(p.patient_id) || 'Unknown Patient',
        doctorName: profileMap.get(p.doctor_id) || 'Unknown Doctor',
        createdAt: new Date(p.created_at!),
        status: p.status,
        items: itemsMap.get(p.id) || [],
        pharmacyId: pharmacyData.id,
        fulfillmentType: p.fulfillment_type,
        deliveryAddress: p.delivery_address,
      }));

      setPrescriptions(formattedPrescriptions);
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [user]);

  const updatePrescriptionStatus = async (prescriptionId: string, newStatus: string) => {
    if (!user) return;

    setUpdatingId(prescriptionId);
    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({ status: newStatus })
        .eq('id', prescriptionId);

      if (error) throw error;

      // Find the prescription to get patient info
      const prescription = prescriptions.find(p => p.id === prescriptionId);

      if (prescription) {
        // Get pharmacy name
        const { data: pharmacyData } = await supabase
          .from('pharmacies')
          .select('name')
          .eq('user_id', user.id)
          .single();

        const pharmacyName = pharmacyData?.name || 'Pharmacy';

        // Send notification to patient
        await sendPrescriptionStatusNotification(
          user.id,
          prescription.patientId,
          prescriptionId,
          newStatus,
          pharmacyName
        );
      }

      toast({
        title: "Status Updated",
        description: `Prescription marked as ${newStatus.replace(/_/g, ' ')}. Patient has been notified.`,
      });

      fetchPrescriptions();
    } catch (error) {
      console.error('Error updating prescription:', error);
      toast({
        title: "Error",
        description: "Failed to update prescription status",
        variant: "destructive",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const canUpdateStatus = (status: string) => {
    return ['acknowledged', 'sent'].includes(status);
  };

  return (
    <DashboardLayout requiredRole="pharmacist">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Incoming Prescriptions</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : prescriptions.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No prescriptions yet</h3>
            <p className="text-muted-foreground">
              Prescriptions assigned to your pharmacy will appear here
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((rx) => (
              <GlassCard key={rx.id} className="p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{rx.patientName}</h3>
                        <p className="text-sm text-muted-foreground">
                          From: {rx.doctorName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(rx.createdAt, 'PPP')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[rx.status] || "bg-muted"}>
                        {getStatusLabel(rx.status)}
                      </Badge>
                    </div>
                  </div>

                  {/* Medications */}
                  {rx.items.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {rx.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 text-sm bg-muted px-3 py-2 rounded-lg"
                        >
                          <Pill className="w-4 h-4 text-primary" />
                          <div>
                            <span className="font-medium">{item.medication_name}</span>
                            <span className="text-muted-foreground ml-2">
                              {item.dosage} • {item.frequency} • {item.duration}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fulfillment Info */}
                  {rx.fulfillmentType && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                      {rx.fulfillmentType === 'pickup' ? (
                        <>
                          <Package className="w-5 h-5 text-blue-400" />
                          <span className="text-sm font-medium">Collect at Store</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-5 h-5 text-purple-400" />
                          <div>
                            <span className="text-sm font-medium">Delivery</span>
                            {rx.deliveryAddress && (
                              <p className="text-xs text-muted-foreground mt-0.5">{rx.deliveryAddress}</p>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Action buttons */}
                  {canUpdateStatus(rx.status) && (
                    <div className="flex items-center gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-green-500 hover:text-green-600 hover:border-green-500"
                        onClick={() => updatePrescriptionStatus(rx.id, 'in_stock')}
                        disabled={updatingId === rx.id}
                      >
                        {updatingId === rx.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        In Stock
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => updatePrescriptionStatus(rx.id, 'out_of_stock')}
                        disabled={updatingId === rx.id}
                      >
                        {updatingId === rx.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                        Out of Stock
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 ml-auto"
                        onClick={() => updatePrescriptionStatus(rx.id, 'preparing')}
                        disabled={updatingId === rx.id}
                      >
                        Start Preparing
                      </Button>
                    </div>
                  )}

                  {rx.status === 'in_stock' && (
                    <div className="flex items-center gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        onClick={() => updatePrescriptionStatus(rx.id, 'preparing')}
                        disabled={updatingId === rx.id}
                      >
                        {updatingId === rx.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Start Preparing
                      </Button>
                    </div>
                  )}

                  {rx.status === 'preparing' && (
                    <div className="flex items-center gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        onClick={() => updatePrescriptionStatus(rx.id, 'ready')}
                        disabled={updatingId === rx.id}
                      >
                        {updatingId === rx.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Mark as Ready
                      </Button>
                    </div>
                  )}

                  {rx.status === 'ready' && (
                    <div className="flex items-center gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updatePrescriptionStatus(rx.id, 'out_for_delivery')}
                        disabled={updatingId === rx.id}
                      >
                        Out for Delivery
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updatePrescriptionStatus(rx.id, 'fulfilled')}
                        disabled={updatingId === rx.id}
                      >
                        {updatingId === rx.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Mark as Collected
                      </Button>
                    </div>
                  )}

                  {rx.status === 'out_for_delivery' && (
                    <div className="flex items-center gap-2 border-t border-border pt-4">
                      <Button
                        size="sm"
                        onClick={() => updatePrescriptionStatus(rx.id, 'fulfilled')}
                        disabled={updatingId === rx.id}
                      >
                        {updatingId === rx.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Mark as Delivered
                      </Button>
                    </div>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
