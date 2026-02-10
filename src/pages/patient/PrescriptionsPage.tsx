import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SelectPharmacyDialog } from "@/components/prescription/SelectPharmacyDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Pill, Building, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
  doctorName: string;
  pharmacyName: string | null;
  createdAt: Date;
  status: string;
  items: PrescriptionItem[];
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

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | null>(null);
  const [showPharmacyDialog, setShowPharmacyDialog] = useState(false);
  const { user } = useAuth();

  const fetchPrescriptions = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch prescriptions for the patient
      const { data: prescriptionsData, error: prescriptionsError } = await supabase
        .from('prescriptions')
        .select('id, doctor_id, pharmacy_id, status, created_at')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });

      if (prescriptionsError) throw prescriptionsError;

      if (!prescriptionsData || prescriptionsData.length === 0) {
        setPrescriptions([]);
        setIsLoading(false);
        return;
      }

      // Fetch doctor profiles
      const doctorIds = [...new Set(prescriptionsData.map(p => p.doctor_id))];
      const { data: doctorProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', doctorIds);

      const doctorMap = new Map(doctorProfiles?.map(d => [d.user_id, d.full_name]) || []);

      // Fetch pharmacy names
      const pharmacyIds = prescriptionsData
        .map(p => p.pharmacy_id)
        .filter((id): id is string => id !== null);
      
      let pharmacyMap = new Map<string, string>();
      if (pharmacyIds.length > 0) {
        const { data: pharmacies } = await supabase
          .from('pharmacies')
          .select('id, name')
          .in('id', pharmacyIds);
        
        pharmacyMap = new Map(pharmacies?.map(p => [p.id, p.name]) || []);
      }

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
        doctorName: doctorMap.get(p.doctor_id) || 'Unknown Doctor',
        pharmacyName: p.pharmacy_id ? pharmacyMap.get(p.pharmacy_id) || null : null,
        createdAt: new Date(p.created_at!),
        status: p.status,
        items: itemsMap.get(p.id) || [],
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

  const handleSelectPharmacy = (prescriptionId: string) => {
    setSelectedPrescriptionId(prescriptionId);
    setShowPharmacyDialog(true);
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <DashboardLayout requiredRole="patient">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Prescriptions</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : prescriptions.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No prescriptions yet</h3>
            <p className="text-muted-foreground">
              Prescriptions from your doctors will appear here
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((prescription) => (
              <GlassCard key={prescription.id} className="p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{prescription.doctorName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(prescription.createdAt, 'PPP')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[prescription.status] || "bg-muted"}>
                        {getStatusLabel(prescription.status)}
                      </Badge>
                    </div>
                  </div>

                  {/* Medications */}
                  {prescription.items.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {prescription.items.map((item) => (
                        <span
                          key={item.id}
                          className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full"
                        >
                          <Pill className="w-3 h-3" />
                          {item.medication_name} {item.dosage}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Pharmacy info or select button */}
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    {prescription.pharmacyName ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building className="w-4 h-4" />
                        <span>Sent to: <span className="text-foreground font-medium">{prescription.pharmacyName}</span></span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building className="w-4 h-4" />
                        <span>No pharmacy selected</span>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      {!prescription.pharmacyName && (
                        <Button
                          size="sm"
                          onClick={() => handleSelectPharmacy(prescription.id)}
                        >
                          Select Pharmacy
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="w-4 h-4" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {selectedPrescriptionId && (
          <SelectPharmacyDialog
            open={showPharmacyDialog}
            onOpenChange={setShowPharmacyDialog}
            prescriptionId={selectedPrescriptionId}
            onSuccess={fetchPrescriptions}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
