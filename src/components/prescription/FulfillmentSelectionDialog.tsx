import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Package, MapPin, Loader2 } from "lucide-react";

interface FulfillmentSelectionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prescriptionId: string;
    patientId: string;
    onSuccess?: () => void;
}

export function FulfillmentSelectionDialog({
    open,
    onOpenChange,
    prescriptionId,
    patientId,
    onSuccess
}: FulfillmentSelectionDialogProps) {
    const [type, setType] = useState<"pickup" | "delivery">("pickup");
    const [address, setAddress] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    const handleConfirm = async () => {
        if (type === "delivery" && !address.trim()) {
            toast({
                title: "Address Required",
                description: "Please enter a delivery address.",
                variant: "destructive",
            });
            return;
        }

        setIsLoading(true);
        try {
            // 1. Get the single pharmacy
            const { data: pharmacyData } = await supabase
                .from('pharmacies')
                .select('id')
                .limit(1)
                .single();

            if (!pharmacyData) {
                throw new Error('No pharmacy found in the system');
            }

            // 2. Update the prescription with fulfillment info, assign pharmacy, and change status
            const { error: rxError } = await supabase
                .from('prescriptions')
                .update({
                    fulfillment_type: type,
                    delivery_address: type === "delivery" ? address.trim() : null,
                    pharmacy_id: pharmacyData.id,
                    status: 'sent'
                })
                .eq('id', prescriptionId);

            if (rxError) throw rxError;

            toast({
                title: type === "pickup" ? "Pickup Selected" : "Delivery Selected",
                description: type === "pickup"
                    ? "Your prescription has been sent to the pharmacy for pickup."
                    : `Your prescription will be delivered to: ${address.trim()}`,
            });

            onOpenChange(false);
            onSuccess?.();
        } catch (error) {
            console.error('Error confirming fulfillment:', error);
            toast({
                title: "Error",
                description: "Failed to confirm selection. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] glass-card border-border">
                <DialogHeader>
                    <DialogTitle className="text-xl font-display">How would you like to get your medicine?</DialogTitle>
                </DialogHeader>

                <div className="py-6">
                    <RadioGroup value={type} onValueChange={(v: "pickup" | "delivery") => setType(v)} className="grid grid-cols-2 gap-4">
                        <div>
                            <RadioGroupItem value="pickup" id="pickup" className="peer sr-only" />
                            <Label
                                htmlFor="pickup"
                                className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-muted/30 p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                                <Package className="mb-3 h-6 w-6 text-primary" />
                                <span className="text-sm font-medium">Collect at Store</span>
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="delivery" id="delivery" className="peer sr-only" />
                            <Label
                                htmlFor="delivery"
                                className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-muted/30 p-4 hover:bg-muted/50 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                                <MapPin className="mb-3 h-6 w-6 text-primary" />
                                <span className="text-sm font-medium">Deliver to Me</span>
                            </Label>
                        </div>
                    </RadioGroup>

                    {type === "delivery" && (
                        <div className="mt-6 space-y-2 animate-fade-in">
                            <Label htmlFor="address">Delivery Address</Label>
                            <Input
                                id="address"
                                placeholder="Enter your full delivery address"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="bg-muted/30"
                            />
                        </div>
                    )}
                </div>

                <Button
                    className="w-full"
                    onClick={handleConfirm}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Confirm & Send to Pharmacy
                </Button>
            </DialogContent>
        </Dialog>
    );
}
