import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Search, Trash2, Loader2, Pill, MapPin, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Pharmacy {
    id: string;
    user_id: string;
    name: string;
    address: string;
    phone: string | null;
    created_at: string;
}

export default function PharmaciesPage() {
    const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
    const [filteredPharmacies, setFilteredPharmacies] = useState<Pharmacy[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [deletePharmacy, setDeletePharmacy] = useState<Pharmacy | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const { toast } = useToast();

    const fetchPharmacies = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('pharmacies')
                .select('*')
                .order('name', { ascending: true });

            if (error) throw error;
            setPharmacies(data || []);
            setFilteredPharmacies(data || []);
        } catch (error) {
            console.error('Error fetching pharmacies:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeletePharmacy = async () => {
        if (!deletePharmacy) return;
        setIsDeleting(true);
        try {
            // Since pharmacies are linked to users, we use the same admin_delete_user RPC
            // which handles cascading deletion of the pharmacy record too.
            const { error } = await supabase.rpc('admin_delete_user', {
                target_user_id: deletePharmacy.user_id,
            });

            if (error) throw error;

            toast({
                title: "Pharmacy deleted",
                description: `${deletePharmacy.name} and its associated user account have been removed.`,
            });

            setDeletePharmacy(null);
            fetchPharmacies();
        } catch (error: any) {
            console.error('Error deleting pharmacy:', error);
            toast({
                title: "Error",
                description: error.message || "Failed to delete pharmacy.",
                variant: "destructive",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    useEffect(() => {
        fetchPharmacies();
    }, []);

    useEffect(() => {
        const filtered = pharmacies.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.address.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredPharmacies(filtered);
    }, [searchQuery, pharmacies]);

    return (
        <DashboardLayout requiredRole="admin">
            <div className="space-y-6 pb-24 lg:pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold font-display">Manage Pharmacies</h1>
                        <p className="text-sm text-muted-foreground">Monitor and manage registered pharmacy outlets</p>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name or address..."
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
                ) : filteredPharmacies.length === 0 ? (
                    <GlassCard className="p-12 text-center">
                        <Pill className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                            {searchQuery ? "No matches found" : "No pharmacies registered"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {searchQuery ? "Try a different search term" : "Registered pharmacies will appear here"}
                        </p>
                    </GlassCard>
                ) : (
                    <div className="grid gap-4">
                        {filteredPharmacies.map((pharmacy) => (
                            <GlassCard key={pharmacy.id} className="p-5">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Pill className="w-6 h-6 text-primary" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-semibold text-lg">{pharmacy.name}</h3>
                                            <div className="mt-1 space-y-1">
                                                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    <span className="truncate">{pharmacy.address}</span>
                                                </p>
                                                {pharmacy.phone && (
                                                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                        <Phone className="w-3.5 h-3.5" />
                                                        <span>{pharmacy.phone}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                                            Active
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => setDeletePharmacy(pharmacy)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={!!deletePharmacy} onOpenChange={(open) => !open && setDeletePharmacy(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Pharmacy</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{deletePharmacy?.name}</strong>?
                            This will also remove the associated staff user account and all inventory data.
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setDeletePharmacy(null)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDeletePharmacy} disabled={isDeleting}>
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                            Permamently Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DashboardLayout>
    );
}
