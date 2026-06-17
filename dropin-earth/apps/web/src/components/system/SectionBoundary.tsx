"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type SectionBoundaryProps = {
  /** Server-rendered subtree to protect. */
  children: ReactNode;
  /** Static, dependency-free markup rendered if the subtree throws. */
  fallback: ReactNode;
  /** Short label used for dev logging only. */
  label?: string;
};

type SectionBoundaryState = {
  hasError: boolean;
};

/**
 * Client error boundary for data-rich sections.
 *
 * If a wrapped section throws during render (dynamic data crash, registry
 * timeout surfaced as a thrown error, hydration mismatch), the boundary swaps in
 * a predefined static fallback instead of taking down the whole page. The
 * fallback is passed in as already-rendered server markup, so it carries no
 * runtime dependencies of its own — it cannot itself fail for the same reason.
 */
export class SectionBoundary extends Component<SectionBoundaryProps, SectionBoundaryState> {
  state: SectionBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SectionBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (process.env.NODE_ENV !== "production") {
      const tag = this.props.label ? `SectionBoundary:${this.props.label}` : "SectionBoundary";
      console.error(`[${tag}]`, error, info.componentStack);
    }
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
