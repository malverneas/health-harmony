import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreatePrescriptionDialog } from "@/components/prescription/CreatePrescriptionDialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface Prescription {
  id: string;
  patientName: string;
  createdAt: Date;
  medicationCount: number;
  status: string;
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

export default function DoctorPrescriptionsPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  const fetchPrescriptions = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(`
          id,
          created_at,
          status,
          patient_id
        `)
        .eq('doctor_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch patient profiles
        const patientIds = [...new Set(data.map(p => p.patient_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', patientIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);

        // Fetch medication counts
        const prescriptionIds = data.map(p => p.id);
        const { data: items } = await supabase
          .from('prescription_items')
          .select('prescription_id')
          .in('prescription_id', prescriptionIds);

        const countMap = new Map<string, number>();
        items?.forEach(item => {
          countMap.set(item.prescription_id, (countMap.get(item.prescription_id) || 0) + 1);
        });

        setPrescriptions(data.map(p => ({
          id: p.id,
          patientName: profileMap.get(p.patient_id) || 'Unknown Patient',
          createdAt: new Date(p.created_at),
          medicationCount: countMap.get(p.id) || 0,
          status: p.status
        })));
      } else {
        setPrescriptions([]);
      }
    } catch (error) {
      console.error('Error fetching prescriptions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [user]);

  return (
    <DashboardLayout requiredRole="doctor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Prescriptions</h1>
          <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4" />
            New
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : prescriptions.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No prescriptions yet</h3>
            <p className="text-muted-foreground mb-4">Create your first prescription</p>
            <Button onClick={() => setShowCreateDialog(true)}>Create Prescription</Button>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((rx) => (
              <GlassCard key={rx.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{rx.patientName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(rx.createdAt, 'PPP')} • {rx.medicationCount} medication(s)
                      </p>
                    </div>
                  </div>
                  <Badge className={statusColors[rx.status]}>
                    {rx.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        <CreatePrescriptionDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onSuccess={fetchPrescriptions}
        />
      </div>
    </DashboardLayout>
  );
}