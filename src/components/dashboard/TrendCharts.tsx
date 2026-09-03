"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

// --- Mock Data ---
const objectiveData = [
  { quarter: "Q1", achieved: 12, target: 15 },
  { quarter: "Q2", achieved: 18, target: 18 },
  { quarter: "Q3", achieved: 14, target: 20 },
  { quarter: "Q4", achieved: 0, target: 22 }, // Future
]

const kpiData = [
  { month: "Jan", score: 82 },
  { month: "Feb", score: 86 },
  { month: "Mar", score: 89 },
  { month: "Apr", score: 85 },
  { month: "May", score: 92 },
  { month: "Jun", score: 88 },
]

// --- Chart Configs ---
const objectiveConfig = {
  achieved: {
    label: "Achieved",
    color: "hsl(var(--primary))",
  },
  target: {
    label: "Target",
    color: "hsl(var(--muted-foreground))",
  },
} satisfies ChartConfig

const kpiConfig = {
  score: {
    label: "Performance Score (%)",
    color: "var(--coral)",
  },
} satisfies ChartConfig

export function TrendCharts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      
      {/* ── Objectives Progress (Bar Chart) ── */}
      <Card>
        <CardHeader>
          <CardTitle>Objective Completion</CardTitle>
          <CardDescription>Quarterly targets vs achieved</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={objectiveConfig} className="h-[300px] w-full">
            <BarChart accessibilityLayer data={objectiveData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="quarter"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis tickLine={false} axisLine={false} tickMargin={10} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
              <Bar dataKey="achieved" fill="var(--color-achieved)" radius={4} />
              <Bar dataKey="target" fill="var(--color-target)" opacity={0.3} radius={4} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* ── KPI Trend (Area Chart) ── */}
      <Card>
        <CardHeader>
          <CardTitle>KPI Performance Trend</CardTitle>
          <CardDescription>Aggregate score over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={kpiConfig} className="h-[300px] w-full">
            <AreaChart accessibilityLayer data={kpiData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={10} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="var(--color-score)"
                fill="var(--color-score)"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

    </div>
  )
}
