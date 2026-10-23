import type { Metadata } from "next";
import { StewardshipExperience } from "@/components/child-stewardship/StewardshipExperience";

export const metadata: Metadata = {
  title: "一起观察，慢慢认识 · CanopyProof 树木守护演示",
  description: "合成树木、室内观察、加密本机草稿与诚实的学习反馈。真实儿童注册、现场任务、资金和碳交易尚未开放。",
  alternates: { canonical: "https://canopyproof.org/stewardship" },
  robots: { index: false, follow: false },
};

export default function StewardshipPage() {
  return <StewardshipExperience />;
}
