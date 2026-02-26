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
import {
  Pill,
  Search,
  AlertTriangle,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Package,
  DollarSign,
  Hash,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface InventoryItem {
  id: string;
  pharmacy_id: string;
  medication_name: string;
  dosage: string | null;
  quantity: number;
  low_stock_threshold: number;
  unit_price: number | null;
  category: string;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ["General", "Antibiotics", "Painkillers", "Cardiovascular", "Diabetes", "Vitamins", "Dermatology", "Other"];

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDosage, setFormDosage] = useState("");
  const [formQuantity, setFormQuantity] = useState("");
  const [formThreshold, setFormThreshold] = useState("10");
  const [formPrice, setFormPrice] = useState("");
  const [formCategory, setFormCategory] = useState("General");

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      fetchPharmacyId();
    }
  }, [user]);

  useEffect(() => {
    if (pharmacyId) {
      fetchInventory();
    }
  }, [pharmacyId]);

  const fetchPharmacyId = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("pharmacies")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setPharmacyId(data.id);
    }
  };

  const fetchInventory = async () => {
    if (!pharmacyId) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase
        .from("pharmacy_inventory" as any)
        .select("*")
        .eq("pharmacy_id", pharmacyId)
        .order("medication_name", { ascending: true }) as any);

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormDosage("");
    setFormQuantity("");
    setFormThreshold("10");
    setFormPrice("");
    setFormCategory("General");
  };

  const openEditDialog = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormName(item.medication_name);
    setFormDosage(item.dosage || "");
    setFormQuantity(item.quantity.toString());
    setFormThreshold(item.low_stock_threshold.toString());
    setFormPrice(item.unit_price?.toString() || "");
    setFormCategory(item.category || "General");
    setShowEditDialog(true);
  };

  const handleAddItem = async () => {
    if (!pharmacyId || !formName.trim() || !formQuantity.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await (supabase.from("pharmacy_inventory" as any).insert({
        pharmacy_id: pharmacyId,
        medication_name: formName.trim(),
        dosage: formDosage.trim() || null,
        quantity: parseInt(formQuantity),
        low_stock_threshold: parseInt(formThreshold) || 10,
        unit_price: formPrice ? parseFloat(formPrice) : null,
        category: formCategory,
      }) as any);

      if (error) throw error;

      toast({ title: "Item added", description: `${formName} has been added to inventory.` });
      setShowAddDialog(false);
      resetForm();
      fetchInventory();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add item.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!selectedItem || !formName.trim() || !formQuantity.trim()) return;
    setIsSaving(true);
    try {
      const { error } = await (supabase
        .from("pharmacy_inventory" as any)
        .update({
          medication_name: formName.trim(),
          dosage: formDosage.trim() || null,
          quantity: parseInt(formQuantity),
          low_stock_threshold: parseInt(formThreshold) || 10,
          unit_price: formPrice ? parseFloat(formPrice) : null,
          category: formCategory,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedItem.id) as any);

      if (error) throw error;

      toast({ title: "Item updated", description: `${formName} has been updated.` });
      setShowEditDialog(false);
      setSelectedItem(null);
      resetForm();
      fetchInventory();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update item.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedItem) return;
    setIsSaving(true);
    try {
      const { error } = await (supabase
        .from("pharmacy_inventory" as any)
        .delete()
        .eq("id", selectedItem.id) as any);

      if (error) throw error;

      toast({ title: "Item deleted", description: `${selectedItem.medication_name} has been removed.` });
      setShowDeleteDialog(false);
      setSelectedItem(null);
      fetchInventory();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete item.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return "out";
    if (item.quantity <= item.low_stock_threshold) return "low";
    return "good";
  };

  const statusColors: Record<string, string> = {
    good: "bg-green-500/20 text-green-500",
    low: "bg-yellow-500/20 text-yellow-500",
    out: "bg-red-500/20 text-red-500",
  };

  const statusLabels: Record<string, string> = {
    good: "In Stock",
    low: "Low Stock",
    out: "Out of Stock",
  };

  const filteredInventory = inventory.filter(
    (item) =>
      item.medication_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.dosage || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalItems = inventory.length;
  const lowStockCount = inventory.filter((i) => getStockStatus(i) === "low").length;
  const outOfStockCount = inventory.filter((i) => getStockStatus(i) === "out").length;

  return (
    <DashboardLayout requiredRole="pharmacist">
      <div className="space-y-6 pb-24 lg:pb-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Inventory Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your pharmacy stock</p>
          </div>
          <Button className="gap-2" onClick={() => { resetForm(); setShowAddDialog(true); }}>
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <GlassCard className="p-4 text-center">
            <Package className="w-5 h-5 mx-auto text-blue-500 mb-1" />
            <p className="text-xl font-bold">{totalItems}</p>
            <p className="text-xs text-muted-foreground">Total Products</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
            <p className="text-xl font-bold">{lowStockCount}</p>
            <p className="text-xs text-muted-foreground">Low Stock</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto text-red-500 mb-1" />
            <p className="text-xl font-bold">{outOfStockCount}</p>
            <p className="text-xs text-muted-foreground">Out of Stock</p>
          </GlassCard>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search medications..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Inventory List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredInventory.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? "No matches found" : "No inventory items"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery ? "Try a different search term" : "Add your first product to get started"}
            </p>
            {!searchQuery && (
              <Button size="sm" onClick={() => { resetForm(); setShowAddDialog(true); }}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            )}
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {filteredInventory.map((item) => {
              const status = getStockStatus(item);
              return (
                <GlassCard key={item.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${status === "good" ? "bg-green-500/10" : status === "low" ? "bg-yellow-500/10" : "bg-red-500/10"
                        }`}>
                        <Pill className={`w-5 h-5 ${status === "good" ? "text-green-500" : status === "low" ? "text-yellow-500" : "text-red-500"
                          }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{item.medication_name}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {item.dosage && <span>{item.dosage}</span>}
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            {item.quantity} units
                          </span>
                          {item.unit_price && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              {item.unit_price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="text-[10px] hidden sm:inline-flex bg-muted/50 text-muted-foreground">{item.category}</Badge>
                      {status !== "good" && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                      <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => { setSelectedItem(item); setShowDeleteDialog(true); }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>Add a new medication to your inventory.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Medication Name *</label>
              <Input placeholder="e.g. Amoxicillin" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Dosage</label>
                <Input placeholder="e.g. 500mg" value={formDosage} onChange={(e) => setFormDosage(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Quantity *</label>
                <Input type="number" min="0" placeholder="0" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Low Stock Alert</label>
                <Input type="number" min="0" placeholder="10" value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Unit Price</label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleAddItem} disabled={isSaving || !formName.trim() || !formQuantity.trim()}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) { setShowEditDialog(false); setSelectedItem(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>Update stock details for {selectedItem?.medication_name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Medication Name *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Dosage</label>
                <Input value={formDosage} onChange={(e) => setFormDosage(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Quantity *</label>
                <Input type="number" min="0" value={formQuantity} onChange={(e) => setFormQuantity(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Low Stock Alert</label>
                <Input type="number" min="0" value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Unit Price</label>
                <Input type="number" min="0" step="0.01" value={formPrice} onChange={(e) => setFormPrice(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedItem(null); }} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleUpdateItem} disabled={isSaving || !formName.trim() || !formQuantity.trim()}>
              {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={(open) => { if (!open) { setShowDeleteDialog(false); setSelectedItem(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{selectedItem?.medication_name}</strong> from your inventory?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowDeleteDialog(false); setSelectedItem(null); }} disabled={isSaving}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteItem} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
