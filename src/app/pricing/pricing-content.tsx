"use client";

import { useState } from "react";
import { REGIONS as PRICING_REGIONS, PRICING_DATE, type RegionPricing } from "@/lib/pricing";

const STORAGE_TIERS = [
  { label: "1 GB", gb: 1 },
  { label: "10 GB", gb: 10 },
  { label: "50 GB", gb: 50 },
  { label: "100 GB", gb: 100 },
  { label: "500 GB", gb: 500 },
  { label: "1 TB", gb: 1024 },
];

const PREVIEW_RATIO = 0.08;

function fmt(n: number) {
  if (n === 0) return "Free";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export function PricingContent() {
  const [selectedRegion, setSelectedRegion] = useState("ap-south-1");
  const pricing: RegionPricing = PRICING_REGIONS[selectedRegion] || PRICING_REGIONS["us-east-1"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold">Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          taimumashin is free. You only pay AWS directly for storage and retrieval in your own account.
        </p>
      </div>

      <select
        value={selectedRegion}
        onChange={(e) => setSelectedRegion(e.target.value)}
        className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {Object.entries(PRICING_REGIONS).map(([key, r]) => (
          <option key={key} value={key}>
            {r.label} ({key})
          </option>
        ))}
      </select>

      {/* Storage costs */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Monthly Storage</h2>
        <p className="text-xs text-muted-foreground">
          Originals go to Glacier Flexible Retrieval. Previews (~8% of your data) stay in S3 Standard for instant thumbnails.
        </p>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs">
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-right font-medium">Glacier Flexible</th>
                <th className="px-3 py-2 text-right font-medium">Previews (~8%)</th>
                <th className="px-3 py-2 text-right font-medium">Total/mo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {STORAGE_TIERS.map((tier) => {
                const glacier = tier.gb * pricing.glacierPerGB;
                const preview = tier.gb * PREVIEW_RATIO * pricing.standardPerGB;
                const total = glacier + preview;
                return (
                  <tr key={tier.label} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-medium">{tier.label}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{fmt(glacier)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{fmt(preview)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{fmt(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Retrieval costs */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">Retrieval (one-time, when you restore)</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs">
                <th className="px-3 py-2 text-left font-medium">Data</th>
                <th className="px-3 py-2 text-right font-medium">Expedited ({pricing.restore.expedited.time})</th>
                <th className="px-3 py-2 text-right font-medium">Standard ({pricing.restore.standard.time})</th>
                <th className="px-3 py-2 text-right font-medium">Bulk ({pricing.restore.bulk.time})</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {STORAGE_TIERS.map((tier) => {
                const expedited = tier.gb * pricing.restore.expedited.perGB;
                const standard = tier.gb * pricing.restore.standard.perGB;
                const bulk = tier.gb * pricing.restore.bulk.perGB;
                return (
                  <tr key={tier.label} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-medium">{tier.label}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{fmt(expedited)}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{fmt(standard)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{fmt(bulk)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Pricing as of {PRICING_DATE}. Previews estimated at ~8% of original data.</p>
        <p>Data transfer out is free under 100 GB/month. Check aws.amazon.com/s3/pricing for latest rates.</p>
      </div>
    </div>
  );
}
