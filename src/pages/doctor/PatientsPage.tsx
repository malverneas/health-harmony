import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Search, FileText, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface Patient {
  id: string;
  name: string;
  email: string;
  lastVisit: Date | null;
  consultationCount: number;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    fetchPatients();
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPatients(patients);
    } else {
      setFilteredPatients(
        patients.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, patients]);

  const fetchPatients = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      // Get all consultations for this doctor to find unique patients
      const { data: consultations, error } = await supabase
        .from('consultations')
        .select('patient_id, scheduled_at')
        .eq('doctor_id', user.id)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;

      if (consultations && consultations.length > 0) {
        // Get unique patient IDs and their consultation info
        const patientMap = new Map<string, { lastVisit: Date; count: number }>();
        
        consultations.forEach(c => {
          const existing = patientMap.get(c.patient_id);
          if (existing) {
            existing.count += 1;
          } else {
            patientMap.set(c.patient_id, {
              lastVisit: new Date(c.scheduled_at),
              count: 1
            });
          }
        });

        const patientIds = Array.from(patientMap.keys());

        // Fetch patient profiles
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', patientIds);

        if (profiles) {
          setPatients(profiles.map(p => ({
            id: p.user_id,
            name: p.full_name,
            email: p.email,
            lastVisit: patientMap.get(p.user_id)?.lastVisit || null,
            consultationCount: patientMap.get(p.user_id)?.count || 0
          })));
        }
      } else {
        setPatients([]);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout requiredRole="doctor">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">My Patients</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search patients..." 
              className="pl-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredPatients.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {patients.length === 0 ? "No patients yet" : "No matching patients"}
            </h3>
            <p className="text-muted-foreground">
              {patients.length === 0 
                ? "Patients who book consultations with you will appear here"
                : "Try a different search term"
              }
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {filteredPatients.map((patient) => (
              <GlassCard key={patient.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{patient.name}</h3>
                      <p className="text-sm text-muted-foreground">{patient.email}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {patient.consultationCount} consultation(s) • Last: {patient.lastVisit ? format(patient.lastVisit, 'MMM d, yyyy') : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="gap-2">
                    <FileText className="w-4 h-4" />
                    View
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
