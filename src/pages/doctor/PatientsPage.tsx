import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Patient {
  id: string;
  name: string;
  email: string;
  lastVisit: Date | null;
  consultationCount: number;
  membershipNumber?: string;
}

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
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
          p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (p.membershipNumber && p.membershipNumber.toLowerCase().includes(searchQuery.toLowerCase()))
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
          .select('user_id, full_name, email, membership_number')
          .in('user_id', patientIds);

        if (profiles) {
          setPatients(profiles.map(p => ({
            id: p.user_id,
            name: p.full_name,
            email: p.email,
            lastVisit: patientMap.get(p.user_id)?.lastVisit || null,
            consultationCount: patientMap.get(p.user_id)?.count || 0,
            membershipNumber: p.membership_number
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
          <GlassCard className="p-8 text-center" id="empty-patients-view">
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
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <FileText className="w-4 h-4" />
                    View
                  </Button>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Patient Details
            </DialogTitle>
            <DialogDescription>
              Comprehensive information about {selectedPatient?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Full Name</p>
                <p className="text-sm font-medium">{selectedPatient?.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Email Address</p>
                <p className="text-sm font-medium truncate">{selectedPatient?.email}</p>
              </div>
              <div className="space-y-1 border-t border-border/50 pt-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Membership ID</p>
                <p className="text-sm font-bold text-primary">{selectedPatient?.membershipNumber || 'Not provided'}</p>
              </div>
              <div className="space-y-1 border-t border-border/50 pt-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Last Visit</p>
                <p className="text-sm font-medium">
                  {selectedPatient?.lastVisit ? format(selectedPatient.lastVisit, 'PPP') : 'N/A'}
                </p>
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-xl border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Consultation Summary</p>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  {selectedPatient?.consultationCount} Total
                </Badge>
              </div>
              <p className="text-sm text-balance">
                This patient has completed {selectedPatient?.consultationCount} sessions with you.
                View their full medical history in the prescriptions tab.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setSelectedPatient(null)}>
              Close Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
