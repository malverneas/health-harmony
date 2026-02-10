import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { GlassCard } from "@/components/layout/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, MapPin, ChevronRight } from "lucide-react";

const orders = [
  { id: 1, patient: "John Smith", items: 2, type: "pickup", status: "preparing" },
  { id: 2, patient: "Emma Johnson", items: 1, type: "delivery", status: "ready" },
  { id: 3, patient: "Michael Brown", items: 3, type: "pickup", status: "collected" },
];

const statusColors: Record<string, string> = {
  preparing: "bg-yellow-500/20 text-yellow-500",
  ready: "bg-green-500/20 text-green-500",
  "out-for-delivery": "bg-blue-500/20 text-blue-500",
  collected: "bg-muted text-muted-foreground",
  delivered: "bg-muted text-muted-foreground",
};

const nextStatus: Record<string, string> = {
  preparing: "ready",
  ready: "out-for-delivery",
  "out-for-delivery": "delivered",
};

export default function PharmacyOrdersPage() {
  return (
    <DashboardLayout requiredRole="pharmacist">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Orders</h1>

        <div className="space-y-4">
          {orders.map((order) => (
            <GlassCard key={order.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    {order.type === "delivery" ? (
                      <MapPin className="w-5 h-5 text-primary" />
                    ) : (
                      <Package className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold">{order.patient}</h3>
                    <p className="text-sm text-muted-foreground">{order.items} item(s) • {order.type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[order.status]}>
                    {order.status.replace("-", " ").charAt(0).toUpperCase() + order.status.slice(1).replace("-", " ")}
                  </Badge>
                  {nextStatus[order.status] && (
                    <Button size="sm" variant="ghost">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
