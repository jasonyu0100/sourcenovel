"use client";

import { useState } from "react";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/outline";

const SECTIONS = [
  {
    title: "Getting Started",
    items: [
      {
        q: "What is SourceNovel?",
        a: "SourceNovel is a platform for interactive visual fiction. Each story combines cinematic manga panels, voice narration, and AI-powered interactive episodes where you make choices that shape the narrative.",
      },
      {
        q: "How do I start reading?",
        a: "From the home page, select a story to enter its world. You can read chapters page by page, watch cinematic episodes with narration, or jump into interactive episodes where you control the story.",
      },
      {
        q: "Do I need an account?",
        a: "You can browse and read published chapters without an account. An account is needed for interactive episodes, saving progress across devices, and accessing community scenarios.",
      },
    ],
  },
  {
    title: "Reading & Episodes",
    items: [
      {
        q: "What are interactive episodes?",
        a: "Interactive episodes let you step into the story as one of the characters. An AI narrator describes scenes and presents choices — your decisions shape what happens next, creating a unique experience every time.",
      },
      {
        q: "Can I replay interactive episodes?",
        a: "Yes. Each playthrough creates different scenes based on your choices. You can replay episodes as many times as you like to explore different paths.",
      },
      {
        q: "What's the difference between chapters and episodes?",
        a: "Chapters are the authored story — manga panels with voice narration you read or watch. Episodes are the interactive version where you participate in the story and make choices.",
      },
    ],
  },
  {
    title: "Account & Billing",
    items: [
      {
        q: "How do I change my plan?",
        a: "Go to Plans from the sidebar to view available tiers. You can upgrade or downgrade at any time — changes take effect at the start of your next billing cycle.",
      },
      {
        q: "Can I cancel my subscription?",
        a: "Yes, you can cancel at any time from your account settings. You'll retain access until the end of your current billing period.",
      },
      {
        q: "What payment methods are accepted?",
        a: "We accept all major credit cards, debit cards, and Apple Pay through our secure payment processor.",
      },
    ],
  },
  {
    title: "Technical",
    items: [
      {
        q: "Which browsers are supported?",
        a: "SourceNovel works best on the latest versions of Chrome, Firefox, Safari, and Edge. Mobile browsers on iOS and Android are fully supported.",
      },
      {
        q: "Why is image generation slow?",
        a: "AI image generation typically takes 10-30 seconds per scene. The quality and consistency of generated images requires significant processing. Pro plan users get priority queue access.",
      },
      {
        q: "My interactive episode isn't loading. What should I do?",
        a: "Try refreshing the page. If the issue persists, check your internet connection and try clearing your browser cache. Interactive episodes require a stable connection for AI responses.",
      },
    ],
  },
];

export default function HelpPage() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggleItem = (key: string) => {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-5">
            <QuestionMarkCircleIcon className="w-7 h-7 text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Help & FAQ</h1>
          <p className="text-slate-400 text-sm">
            Find answers to common questions about SourceNovel.
          </p>
        </div>

        {/* FAQ Sections */}
        <div className="space-y-10">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                {section.title}
              </h2>
              <div className="space-y-2">
                {section.items.map((item, i) => {
                  const key = `${section.title}-${i}`;
                  const isOpen = openItems[key];
                  return (
                    <div key={key} className="border border-slate-800/50 rounded-xl overflow-hidden">
                      <button
                        onClick={() => toggleItem(key)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-slate-200 hover:bg-white/[0.02] transition-colors"
                      >
                        {item.q}
                        <span className="text-slate-500 ml-4 flex-shrink-0">
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div className="mt-16 text-center rounded-2xl border border-slate-800/50 bg-white/[0.02] p-8">
          <h3 className="text-lg font-bold text-white mb-2">Still need help?</h3>
          <p className="text-slate-400 text-sm mb-4">
            Can&apos;t find what you&apos;re looking for? Reach out and we&apos;ll get back to you.
          </p>
          <a
            href="mailto:support@sourcenovel.com"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-slate-700 hover:bg-white/10 text-white text-sm font-medium transition-colors"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
}
