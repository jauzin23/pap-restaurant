"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../../components/ui/chart";

const WeeklyRevenueChart = ({ data = [] }) => {
  const chartConfig = {
    revenue: {
      label: "Receita",
      color: "hsl(var(--chart-1))",
    },
  };

  // Sample data if none provided
  const defaultData = [
    { month: "Janeiro", revenue: 186 },
    { month: "Fevereiro", revenue: 305 },
    { month: "Março", revenue: 237 },
    { month: "Abril", revenue: 173 },
    { month: "Maio", revenue: 209 },
    { month: "Junho", revenue: 214 },
  ];

  const chartData = data.length > 0 ? data : defaultData;

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Receita Semanal</h3>
        <p className="text-sm text-muted-foreground">
          Mostrando a receita total desta semana
        </p>
      </div>

      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <AreaChart
          accessibilityLayer
          data={chartData}
          margin={{
            left: 12,
            right: 12,
            top: 12,
            bottom: 12,
          }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => value.slice(0, 3)}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => `€${value}`}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dot" />}
          />
          <Area
            dataKey="revenue"
            type="natural"
            fill="var(--color-revenue)"
            fillOpacity={0.4}
            stroke="var(--color-revenue)"
            stackId="a"
          />
        </AreaChart>
      </ChartContainer>

      <div className="flex w-full items-start gap-2 text-sm mt-4">
        <div className="grid gap-2">
          <div className="flex items-center gap-2 font-medium leading-none">
            Tendência crescente de 5.2% este mês{" "}
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2 leading-none text-muted-foreground">
            Janeiro - Junho 2024
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyRevenueChart;
