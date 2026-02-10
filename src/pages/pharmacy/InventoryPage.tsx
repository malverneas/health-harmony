import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Pill, Search, AlertTriangle } from "lucide-react";

const inventory = [
  { id: 1, name: "Amoxicillin 500mg", stock: 150, threshold: 50, status: "good" },
  { id: 2, name: "Ibuprofen 400mg", stock: 200, threshold: 100, status: "good" },
  { id: 3, name: "Lisinopril 10mg", stock: 30, threshold: 50, status: "low" },
  { id: 4, name: "Metformin 500mg", stock: 10, threshold: 50, status: "critical" },
];

const statusColors: Record<string, string> = {
  good: "bg-green-500/20 text-green-500",
  low: "bg-yellow-500/20 text-yellow-500",
  critical: "bg-red-500/20 text-red-500",
};

export default function InventoryPage() {
  return (
    <DashboardLayout requiredRole="pharmacist">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Inventory</h1>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search medications..." className="pl-9" />
          </div>
        </div>

        <div className="space-y-4">
          {inventory.map((item) => (
            <GlassCard key={item.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <Pill className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.stock} units in stock</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.status !== "good" && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                  <Badge className={statusColors[item.status]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Badge>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
