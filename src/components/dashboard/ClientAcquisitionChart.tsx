import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ClientData {
  month: string;
  year: number;
  newClients: number;
}

interface ClientAcquisitionChartProps {
  data: ClientData[];
  loading?: boolean;
}

export function ClientAcquisitionChart({ data, loading }: ClientAcquisitionChartProps) {
  const chartData = data.map((item) => ({
    name: `${item.month}`,
    clients: item.newClients,
  }));

  if (loading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading chart...</div>
      </div>
    );
  }

  const totalClients = data.reduce((sum, item) => sum + item.newClients, 0);

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Client Acquisition</h3>
          <p className="text-sm text-muted-foreground">New clients over time</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-success">{totalClients}</p>
          <p className="text-sm text-muted-foreground">Total new clients</p>
        </div>
      </div>

      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [value, 'New Clients']}
            />
            <Bar
              dataKey="clients"
              fill="hsl(var(--success))"
              radius={[4, 4, 0, 0]}
              opacity={0.9}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
