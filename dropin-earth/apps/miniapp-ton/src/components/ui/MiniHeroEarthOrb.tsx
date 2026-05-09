"use client";

import type { MouseEventHandler } from "react";
import Link from "next/link";
import styles from "./MiniHeroEarthOrb.module.css";

type MiniHeroEarthOrbProps = {
  headline?: string;
  subline?: string;
  ctaText?: string;
  ctaHref?: string | undefined;
  onCtaClick?: MouseEventHandler<HTMLButtonElement> | undefined;
};

export function MiniHeroEarthOrb({
  headline = "Join testnet climate-impact pools.",
  subline = "Track every tree through proof. 70% Winner, 20% Verified Reforestation, 10% Dropin Operations. TON / USDC testnet only.",
  ctaText = "Plant & Enter",
  ctaHref,
  onCtaClick,
}: MiniHeroEarthOrbProps) {
  return (
    <section className={styles.hero} aria-label="Earth Seed campaign hero">
      <div className={styles.text}>
        <span className={styles.badge}>Testnet only</span>
        <h1>{headline}</h1>
        <p>{subline}</p>
        {ctaHref ? (
          <Link className={styles.cta} href={ctaHref}>
            {ctaText}
          </Link>
        ) : (
          <button className={styles.cta} disabled={!onCtaClick} onClick={onCtaClick} type="button">
            {ctaText}
          </button>
        )}
      </div>
      <div className={styles.orb} aria-label="Mini Earth and forest proof orb" role="img">
        <span className={styles.trace} aria-hidden="true" />
      </div>
    </section>
  );
}
