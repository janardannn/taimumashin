/**
 * AWS S3 pricing data — single source of truth.
 * All components should import from here instead of hardcoding prices.
 *
 * To update: change the rates below and bump PRICING_DATE.
 * Rates from: https://aws.amazon.com/s3/pricing/
 */

export const PRICING_DATE = "March 2026";

export interface RegionPricing {
  label: string;
  shortLabel: string;
  /** S3 Standard storage per GB/month */
  standardPerGB: number;
  /** S3 Glacier Flexible Retrieval storage per GB/month */
  glacierPerGB: number;
  /** Glacier Flexible restore tiers */
  restore: {
    expedited: { perGB: number; perRequest: number; time: string };
    standard: { perGB: number; perRequest: number; time: string };
    bulk: { perGB: number; perRequest: number; time: string };
  };
}

export const REGIONS: Record<string, RegionPricing> = {
  "us-east-1": {
    label: "US East (N. Virginia)",
    shortLabel: "Virginia",
    standardPerGB: 0.023,
    glacierPerGB: 0.0036,
    restore: {
      expedited: { perGB: 0.03, perRequest: 10, time: "1-5 minutes" },
      standard: { perGB: 0.01, perRequest: 0.05, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
  "us-east-2": {
    label: "US East (Ohio)",
    shortLabel: "Ohio",
    standardPerGB: 0.023,
    glacierPerGB: 0.0036,
    restore: {
      expedited: { perGB: 0.03, perRequest: 10, time: "1-5 minutes" },
      standard: { perGB: 0.01, perRequest: 0.05, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
  "us-west-2": {
    label: "US West (Oregon)",
    shortLabel: "Oregon",
    standardPerGB: 0.023,
    glacierPerGB: 0.0036,
    restore: {
      expedited: { perGB: 0.03, perRequest: 10, time: "1-5 minutes" },
      standard: { perGB: 0.01, perRequest: 0.05, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
  "eu-west-1": {
    label: "Europe (Ireland)",
    shortLabel: "Ireland",
    standardPerGB: 0.023,
    glacierPerGB: 0.0036,
    restore: {
      expedited: { perGB: 0.03, perRequest: 11, time: "1-5 minutes" },
      standard: { perGB: 0.01, perRequest: 0.055, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
  "eu-west-2": {
    label: "Europe (London)",
    shortLabel: "London",
    standardPerGB: 0.024,
    glacierPerGB: 0.00405,
    restore: {
      expedited: { perGB: 0.0315, perRequest: 10.5, time: "1-5 minutes" },
      standard: { perGB: 0.0105, perRequest: 0.053, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
  "eu-north-1": {
    label: "Europe (Stockholm)",
    shortLabel: "Stockholm",
    standardPerGB: 0.023,
    glacierPerGB: 0.0036,
    restore: {
      expedited: { perGB: 0.03, perRequest: 11, time: "1-5 minutes" },
      standard: { perGB: 0.01, perRequest: 0.055, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
  "ap-south-1": {
    label: "Asia Pacific (Mumbai)",
    shortLabel: "Mumbai",
    standardPerGB: 0.025,
    glacierPerGB: 0.0045,
    restore: {
      expedited: { perGB: 0.036, perRequest: 12, time: "1-5 minutes" },
      standard: { perGB: 0.012, perRequest: 0.06, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
  "ap-south-2": {
    label: "Asia Pacific (Hyderabad)",
    shortLabel: "Hyderabad",
    standardPerGB: 0.025,
    glacierPerGB: 0.0045,
    restore: {
      expedited: { perGB: 0.036, perRequest: 12, time: "1-5 minutes" },
      standard: { perGB: 0.012, perRequest: 0.06, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
  "ap-east-1": {
    label: "Asia Pacific (Hong Kong)",
    shortLabel: "Hong Kong",
    standardPerGB: 0.025,
    glacierPerGB: 0.0045,
    restore: {
      expedited: { perGB: 0.036, perRequest: 12, time: "1-5 minutes" },
      standard: { perGB: 0.012, perRequest: 0.06, time: "3-5 hours" },
      bulk: { perGB: 0, perRequest: 0, time: "5-12 hours" },
    },
  },
};

export const DEFAULT_REGION = "us-east-1";

export type RestoreTier = "expedited" | "standard" | "bulk";

/** Get pricing for a region, falling back to default */
export function getRegionPricing(region: string): RegionPricing {
  return REGIONS[region] || REGIONS[DEFAULT_REGION];
}

/** Get all region keys */
export function getRegionKeys(): string[] {
  return Object.keys(REGIONS);
}
