export type UxHeroVariant = "control" | "impact_first" | "proof_first";
export type UxMetricDensity = "standard" | "compact" | "proof";
export type UxCtaLayout = "default" | "wide" | "compact";

export type UxExperienceFlags = {
  experimentId: string;
  variant: UxHeroVariant;
  heroVariant: UxHeroVariant;
  metricDensity: UxMetricDensity;
  ctaLayout: UxCtaLayout;
};

const variants: UxHeroVariant[] = ["control", "impact_first", "proof_first"];

export function selectUxExperience(surface: "web" | "miniapp", seed = "dropin-home"): UxExperienceFlags {
  const override = process.env.NEXT_PUBLIC_DROPIN_UX_EXPERIMENT_VARIANT as UxHeroVariant | undefined;
  const variant = override && variants.includes(override) ? override : variants[scoreSeed(`${surface}:${seed}`) % variants.length] ?? "control";

  return {
    experimentId: `ux_${surface}_home_hero_v1`,
    variant,
    heroVariant: variant,
    metricDensity: variant === "proof_first" ? "proof" : variant === "impact_first" ? "compact" : "standard",
    ctaLayout: variant === "impact_first" ? "wide" : "default",
  };
}

function scoreSeed(seed: string) {
  return [...seed].reduce((total, char) => total + char.charCodeAt(0), 0);
}
