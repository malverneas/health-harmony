import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatePrescriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedPatientId?: string;
}

interface Patient {
  id: string;
  fullName: string;
  email: string;
}

interface MedicationItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const emptyMedication: MedicationItem = {
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: ""
};

export function CreatePrescriptionDialog({
  open,
  onOpenChange,
  onSuccess,
  preselectedPatientId
}: CreatePrescriptionDialogProps) {
  const [step, setStep] = useState(1);
  const [selectedPatient, setSelectedPatient] = useState(preselectedPatientId || "");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medications, setMedications] = useState<MedicationItem[]>([{ ...emptyMedication }]);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPatients();
      if (preselectedPatientId) {
        setSelectedPatient(preselectedPatientId);
      }
    }
  }, [open, preselectedPatientId]);

  const fetchPatients = async () => {
    setIsFetching(true);
    try {
      const { data: patientRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'patient');

      if (patientRoles && patientRoles.length > 0) {
        const patientIds = patientRoles.map(r => r.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', patientIds);

        if (profiles) {
          setPatients(profiles.map(p => ({
            id: p.user_id,
            fullName: p.full_name,
            email: p.email
          })));
        }
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const addMedication = () => {
    setMedications([...medications, { ...emptyMedication }]);
  };

  const removeMedication = (index: number) => {
    if (medications.length > 1) {
      setMedications(medications.filter((_, i) => i !== index));
    }
  };

  const updateMedication = (index: number, field: keyof MedicationItem, value: string) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    setMedications(updated);
  };

  const handleCreate = async () => {
    if (!user || !selectedPatient || medications.some(m => !m.name || !m.dosage)) return;

    setIsLoading(true);
    try {
      // Fetch the first pharmacy (single pharmacy system)
      const { data: pharmacyData } = await supabase
        .from('pharmacies')
        .select('id')
        .limit(1)
        .single();

      // Create prescription
      const { data: prescription, error: prescriptionError } = await supabase
        .from('prescriptions')
        .insert({
          patient_id: selectedPatient,
          doctor_id: user.id,
          pharmacy_id: pharmacyData?.id || null, // Auto-assign if exists
          notes,
          status: 'sent'
        })
        .select()
        .single();

      if (prescriptionError) throw prescriptionError;

      // Add medication items
      const medicationItems = medications.map(m => ({
        prescription_id: prescription.id,
        medication_name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        duration: m.duration,
        instructions: m.instructions
      }));

      const { error: itemsError } = await supabase
        .from('prescription_items')
        .insert(medicationItems);

      if (itemsError) throw itemsError;

      toast({
        title: "Prescription Created!",
        description: "The prescription has been sent to the patient.",
      });

      onOpenChange(false);
      onSuccess?.();
      resetForm();
    } catch (error) {
      console.error('Error creating prescription:', error);
      toast({
        title: "Error",
        description: "Failed to create prescription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedPatient(preselectedPatientId || "");
    setMedications([{ ...emptyMedication }]);
    setNotes("");
  };

  const canProceed = () => {
    if (step === 1) return !!selectedPatient;
    if (step === 2) return medications.every(m => m.name && m.dosage && m.frequency && m.duration);
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] glass-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">New Prescription</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={cn(
                "flex-1 h-1 rounded-full transition-colors",
                s <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">Select patient</p>
            {isFetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : patients.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No patients found</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatient(patient.id)}
                    className={cn(
                      "w-full p-4 rounded-xl border transition-all text-left flex items-center gap-3",
                      selectedPatient === patient.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:border-primary/50"
                    )}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{patient.fullName}</p>
                      <p className="text-sm text-muted-foreground">{patient.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Add medications</p>
              <Button variant="outline" size="sm" onClick={addMedication}>
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>

            <div className="space-y-4 max-h-[400px] overflow-y-auto">
              {medications.map((med, index) => (
                <div key={index} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Medication {index + 1}</span>
                    {medications.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMedication(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Medication name *"
                      value={med.name}
                      onChange={(e) => updateMedication(index, 'name', e.target.value)}
                    />
                    <Input
                      placeholder="Dosage (e.g., 500mg) *"
                      value={med.dosage}
                      onChange={(e) => updateMedication(index, 'dosage', e.target.value)}
                    />
                    <Input
                      placeholder="Frequency (e.g., twice daily) *"
                      value={med.frequency}
                      onChange={(e) => updateMedication(index, 'frequency', e.target.value)}
                    />
                    <Input
                      placeholder="Duration (e.g., 7 days) *"
                      value={med.duration}
                      onChange={(e) => updateMedication(index, 'duration', e.target.value)}
                    />
                  </div>
                  <Input
                    placeholder="Special instructions (optional)"
                    value={med.instructions}
                    onChange={(e) => updateMedication(index, 'instructions', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-muted-foreground">Additional notes</p>
            <Textarea
              placeholder="Add any additional notes for the patient or pharmacy..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
            <div className="p-4 rounded-xl bg-muted/30 border border-border">
              <h4 className="font-medium mb-3">Prescription Summary</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Patient: {patients.find(p => p.id === selectedPatient)?.fullName}
              </p>
              <div className="space-y-2">
                {medications.map((med, index) => (
                  <div key={index} className="text-sm p-2 bg-muted/30 rounded-lg">
                    <p className="font-medium">{med.name} - {med.dosage}</p>
                    <p className="text-muted-foreground">{med.frequency} for {med.duration}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={() => step < 3 ? setStep(step + 1) : handleCreate()}
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : step < 3 ? (
              "Continue"
            ) : (
              "Create Prescription"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}