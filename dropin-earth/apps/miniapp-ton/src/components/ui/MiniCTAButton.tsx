"use client";

import type { MouseEventHandler, ReactNode } from "react";
import Link from "next/link";
import styles from "./MiniCTAButton.module.css";

type MiniCTAButtonProps = {
  children?: ReactNode;
  text?: string;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  variant?: "primary" | "secondary" | "gold";
  disabled?: boolean;
};

export function MiniCTAButton({
  children,
  text,
  href,
  onClick,
  variant = "primary",
  disabled = false,
}: MiniCTAButtonProps) {
  const className = `${styles.cta} ${styles[variant]}`;
  const label = children ?? text;

  if (href && !disabled) {
    return (
      <Link className={className} href={href}>
        {label}
      </Link>
    );
  }

  return (
    <button className={className} disabled={disabled || !onClick} onClick={onClick} type="button">
      {label}
    </button>
  );
}
