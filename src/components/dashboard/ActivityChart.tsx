import { GlassCard } from "@/components/layout/GlassCard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "Mon", consultations: 24, prescriptions: 18 },
  { name: "Tue", consultations: 32, prescriptions: 25 },
  { name: "Wed", consultations: 28, prescriptions: 22 },
  { name: "Thu", consultations: 45, prescriptions: 35 },
  { name: "Fri", consultations: 38, prescriptions: 30 },
  { name: "Sat", consultations: 15, prescriptions: 12 },
  { name: "Sun", consultations: 10, prescriptions: 8 },
];

interface ActivityChartProps {
  title?: string;
}

export function ActivityChart({ title = "Weekly Activity" }: ActivityChartProps) {
  return (
    <GlassCard className="p-6">
      <h2 className="text-lg font-display font-semibold mb-6">{title}</h2>
      
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorConsultations" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(186, 100%, 50%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(186, 100%, 50%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPrescriptions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(270, 60%, 55%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(270, 60%, 55%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
            <XAxis 
              dataKey="name" 
              stroke="hsl(215, 20%, 55%)"
              fontSize={12}
            />
            <YAxis 
              stroke="hsl(215, 20%, 55%)"
              fontSize={12}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(222, 47%, 11%)",
                border: "1px solid hsl(222, 30%, 18%)",
                borderRadius: "12px",
                color: "hsl(210, 40%, 98%)",
              }}
            />
            <Area
              type="monotone"
              dataKey="consultations"
              stroke="hsl(186, 100%, 50%)"
              fillOpacity={1}
              fill="url(#colorConsultations)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="prescriptions"
              stroke="hsl(270, 60%, 55%)"
              fillOpacity={1}
              fill="url(#colorPrescriptions)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Consultations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-secondary" />
          <span className="text-sm text-muted-foreground">Prescriptions</span>
        </div>
      </div>
    </GlassCard>
  );
}
