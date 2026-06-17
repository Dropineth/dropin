"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { apiBaseUrl } from "@/lib/api";

type Surface = "web" | "miniapp";

function sessionIdFor(surface: Surface) {
  const key = `dropin_${surface}_ux_session`;
  const existing = window.localStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const created = `${surface}_${crypto.randomUUID()}`;
  window.localStorage.setItem(key, created);
  return created;
}

function postEvent(event: Record<string, unknown>) {
  const body = JSON.stringify(event);
  const url = `${apiBaseUrl}/ux-experience/events`;
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function UxInteractionCollector({
  surface = "web",
  experimentId,
  variant = "control",
}: {
  surface?: Surface;
  experimentId?: string;
  variant?: string;
}) {
  const pathname = usePathname();
  const startedAt = useMemo(() => Date.now(), []);

  useEffect(() => {
    const sessionId = sessionIdFor(surface);
    postEvent({
      sessionId,
      surface,
      page: pathname,
      component: "Hero",
      eventType: "page_view",
      experimentId,
      variant,
    });

    const clickHandler = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-ux-track]") : null;
      if (!target) {
        return;
      }
      postEvent({
        sessionId,
        surface,
        page: pathname,
        component: target.dataset.uxComponent ?? "CTAButton",
        eventType: target.dataset.uxEvent ?? "cta_click",
        experimentId: target.dataset.experimentId ?? experimentId,
        variant: target.dataset.experimentVariant ?? variant,
        x: event.clientX,
        y: event.clientY,
        metadata: {
          target: target.dataset.uxTrack,
        },
      });
    };

    const scrollHandler = () => {
      const total = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const value = Math.min(100, Math.round((window.scrollY / total) * 100));
      if (value >= 50) {
        postEvent({
          sessionId,
          surface,
          page: pathname,
          component: "Hero",
          eventType: "scroll_depth",
          experimentId,
          variant,
          value,
        });
        window.removeEventListener("scroll", scrollHandler);
      }
    };

    const flushRetention = () => {
      postEvent({
        sessionId,
        surface,
        page: pathname,
        component: "Hero",
        eventType: "retention_tick",
        experimentId,
        variant,
        value: Math.round((Date.now() - startedAt) / 1000),
      });
    };

    document.addEventListener("click", clickHandler);
    window.addEventListener("scroll", scrollHandler, { passive: true });
    window.addEventListener("pagehide", flushRetention);

    return () => {
      document.removeEventListener("click", clickHandler);
      window.removeEventListener("scroll", scrollHandler);
      window.removeEventListener("pagehide", flushRetention);
      flushRetention();
    };
  }, [experimentId, pathname, startedAt, surface, variant]);

  return null;
}
