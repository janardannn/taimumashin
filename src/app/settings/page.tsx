"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Save } from "lucide-react";
import { Footer } from "@/components/footer";

// ─── AWS Region Pricing (source: AWS Bulk Pricing API, Feb 2026) ─────

const REGIONS = [
  { region: "ap-south-1",     label: "Asia Pacific (Mumbai)",    standardPerGB: 0.025,  glacierDeepPerGB: 0.002,   retrievalPerGB: 0.024 },
  { region: "us-east-1",      label: "US East (N. Virginia)",    standardPerGB: 0.023,  glacierDeepPerGB: 0.00099, retrievalPerGB: 0.02  },
  { region: "us-west-2",      label: "US West (Oregon)",         standardPerGB: 0.023,  glacierDeepPerGB: 0.00099, retrievalPerGB: 0.02  },
  { region: "eu-west-1",      label: "Europe (Ireland)",         standardPerGB: 0.023,  glacierDeepPerGB: 0.00099, retrievalPerGB: 0.02  },
  { region: "eu-central-1",   label: "Europe (Frankfurt)",       standardPerGB: 0.0245, glacierDeepPerGB: 0.0018,  retrievalPerGB: 0.024 },
  { region: "ap-southeast-1", label: "Asia Pacific (Singapore)", standardPerGB: 0.025,  glacierDeepPerGB: 0.002,   retrievalPerGB: 0.024 },
  { region: "ap-northeast-1", label: "Asia Pacific (Tokyo)",     standardPerGB: 0.025,  glacierDeepPerGB: 0.002,   retrievalPerGB: 0.022 },
];

const COST_TIERS = [
  { label: "1 GB", gb: 1 },
  { label: "10 GB", gb: 10 },
  { label: "100 GB", gb: 100 },
  { label: "1 TB", gb: 1024 },
];

const PREVIEW_RATIO = 0.08; // previews ≈ 8% of originals size
const USD_TO_INR = 92;

// ─── Preset defaults ─────────────────────────────────────────

const RESTORE_DAY_PRESETS = [1, 3, 5, 7, 10, 14];
const LIFECYCLE_DAY_PRESETS = [1, 3, 5, 7, 14, 30];
const PREVIEW_DURATION_OPTIONS = [10, 15, 20, 30, 45, 60, 90, 120, 180, 300];

// ─────────────────────────────────────────────────────────────

interface Settings {
  roleArn: string | null;
  bucketName: string | null;
  region: string | null;
  notificationEmail: string | null;
  restoreDays: number;
  previewQuality: string;
  previewDurationCap: number;
  lifecycleDays: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  const selectedRegion = useMemo(
    () => REGIONS.find((r) => r.region === (settings?.region || "ap-south-1")) || REGIONS[0],
    [settings?.region]
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage("Settings saved.");
      } else {
        const data = await res.json();
        setMessage(data.error || "Failed to save.");
      }
    } catch {
      setMessage("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <a href="/" className="hover:opacity-80 transition-opacity">
            <span className="text-lg font-bold leading-none">taimumashin</span>
            <span className="block text-[10px] text-muted-foreground leading-none">タイムマシン</span>
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-foreground">Home</Link>
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link>
            <Link href="/settings" className="font-medium">Settings</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>

        <form onSubmit={handleSave} className="space-y-8">
          {/* AWS Connection */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">AWS Connection</h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">IAM Role ARN</label>
                <input
                  type="text"
                  value={settings.roleArn || ""}
                  onChange={(e) => setSettings({ ...settings, roleArn: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">S3 Bucket Name</label>
                <input
                  type="text"
                  value={settings.bucketName || ""}
                  onChange={(e) => setSettings({ ...settings, bucketName: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">AWS Region</label>
                <select
                  value={settings.region || "ap-south-1"}
                  onChange={(e) => setSettings({ ...settings, region: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {REGIONS.map((r) => (
                    <option key={r.region} value={r.region}>
                      {r.label} ({r.region}) — ${r.glacierDeepPerGB}/GB
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Region Pricing + Cost Calculator */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Cost Estimate</h2>
            <p className="text-sm text-muted-foreground">
              Pricing for <span className="font-medium text-foreground">{selectedRegion.label}</span>
            </p>

            {/* Per-GB rates */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Glacier Deep Archive</p>
                <p className="mt-1 text-lg font-bold">${selectedRegion.glacierDeepPerGB}</p>
                <p className="text-xs text-muted-foreground">/GB/month</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">S3 Standard (previews)</p>
                <p className="mt-1 text-lg font-bold">${selectedRegion.standardPerGB}</p>
                <p className="text-xs text-muted-foreground">/GB/month</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-xs text-muted-foreground">Retrieval (Standard)</p>
                <p className="mt-1 text-lg font-bold">${selectedRegion.retrievalPerGB}</p>
                <p className="text-xs text-muted-foreground">/GB retrieved</p>
              </div>
            </div>

            {/* Cost table */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Data</th>
                    <th className="px-3 py-2 text-right font-medium">Glacier</th>
                    <th className="px-3 py-2 text-right font-medium">Previews</th>
                    <th className="px-3 py-2 text-right font-medium">Total/mo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {COST_TIERS.map((tier) => {
                    const glacierCost = tier.gb * selectedRegion.glacierDeepPerGB;
                    const previewCost = tier.gb * PREVIEW_RATIO * selectedRegion.standardPerGB;
                    const total = glacierCost + previewCost;
                    return (
                      <tr key={tier.label} className="hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{tier.label}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          ${glacierCost < 0.01 ? glacierCost.toFixed(4) : glacierCost.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          ${previewCost < 0.01 ? previewCost.toFixed(4) : previewCost.toFixed(2)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          ${total < 0.01 ? total.toFixed(4) : total.toFixed(2)}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {(() => { const inr = total * USD_TO_INR; return `~₹${inr < 1 ? inr.toFixed(2) : inr.toFixed(0)}`; })()}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Previews estimated at ~8% of original data. Data transfer out is free under 100GB/month.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Pricing sourced from AWS Bulk Pricing API (Mar 2026). Rates may have changed since — check aws.amazon.com/s3/pricing for the latest.
            </p>
            <p className="text-xs text-muted-foreground/60">
              INR estimates use $1 = ₹{USD_TO_INR} (Mar 2026).
            </p>
          </section>

          {/* Notifications */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Notifications</h2>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email for restore alerts</label>
              <input
                type="email"
                value={settings.notificationEmail || ""}
                onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
                placeholder="you@example.com"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </section>

          {/* Archive Preferences */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Archive Preferences</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Restore duration — preset buttons */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Restore duration (days)</label>
                <div className="flex flex-wrap gap-1.5">
                  {RESTORE_DAY_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSettings({ ...settings, restoreDays: d })}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        settings.restoreDays === d
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">How long restored files stay available</p>
              </div>

              {/* Lifecycle days — preset buttons */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Lifecycle days (to Glacier)</label>
                <div className="flex flex-wrap gap-1.5">
                  {LIFECYCLE_DAY_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSettings({ ...settings, lifecycleDays: d })}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        settings.lifecycleDays === d
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Days after upload before files sink to Glacier</p>
              </div>

              {/* Preview quality */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Preview quality</label>
                <select
                  value={settings.previewQuality}
                  onChange={(e) => setSettings({ ...settings, previewQuality: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="360p">360p — smallest previews</option>
                  <option value="480p">480p — balanced</option>
                  <option value="720p">720p — best quality</option>
                </select>
              </div>

              {/* Preview duration cap — more options */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Video preview cap</label>
                <div className="flex flex-wrap gap-1.5">
                  {PREVIEW_DURATION_OPTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSettings({ ...settings, previewDurationCap: s })}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        settings.previewDurationCap === s
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      }`}
                    >
                      {s >= 60 ? `${s / 60}m` : `${s}s`}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Max duration for video previews (10% of original, capped here)
                </p>
              </div>
            </div>
          </section>

          {/* Save */}
          {message && (
            <p className={`text-sm ${message.includes("saved") ? "text-green-600" : "text-destructive"}`}>
              {message}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </form>
      </main>

      <Footer />
    </div>
  );
}
