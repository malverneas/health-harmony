import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Building, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectPharmacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prescriptionId: string;
  onSuccess?: () => void;
}

interface Pharmacy {
  id: string;
  name: string;
  address: string;
}

export function SelectPharmacyDialog({ 
  open, 
  onOpenChange, 
  prescriptionId,
  onSuccess 
}: SelectPharmacyDialogProps) {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPharmacies();
    }
  }, [open]);

  const fetchPharmacies = async () => {
    setIsFetching(true);
    try {
      const { data, error } = await supabase
        .from('pharmacies')
        .select('id, name, address');

      if (error) throw error;

      setPharmacies(data || []);
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSelect = async () => {
    if (!selectedPharmacy || !prescriptionId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('prescriptions')
        .update({ 
          pharmacy_id: selectedPharmacy,
          status: 'acknowledged'
        })
        .eq('id', prescriptionId);

      if (error) throw error;

      toast({
        title: "Pharmacy Selected!",
        description: "Your prescription has been sent to the pharmacy.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to select pharmacy. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] glass-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Select Pharmacy</DialogTitle>
        </DialogHeader>

        <p className="text-muted-foreground">Choose a pharmacy to fulfill your prescription</p>

        {isFetching ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : pharmacies.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">No pharmacies available</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pharmacies.map((pharmacy) => (
              <button
                key={pharmacy.id}
                onClick={() => setSelectedPharmacy(pharmacy.id)}
                className={cn(
                  "w-full p-4 rounded-xl border transition-all text-left flex items-center gap-3",
                  selectedPharmacy === pharmacy.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-muted/30 hover:border-primary/50"
                )}
              >
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <Building className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{pharmacy.name}</p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {pharmacy.address}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <Button
          className="w-full mt-4"
          onClick={handleSelect}
          disabled={!selectedPharmacy || isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Send to Pharmacy"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}