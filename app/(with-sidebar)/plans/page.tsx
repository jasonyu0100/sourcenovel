"use client";

import { useState } from "react";
import { CheckIcon, SparklesIcon } from "@heroicons/react/24/outline";

const TIERS = [
  {
    name: "Starter",
    price: "$7.99",
    period: "/month",
    description: "Perfect for casual readers exploring interactive fiction.",
    features: [
      "3 active stories",
      "10 interactive episodes per month",
      "Standard image generation",
      "Standard AI model",
      "Community scenarios",
      "Basic reading analytics",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$14.99",
    period: "/month",
    description: "For dedicated readers who want the full experience.",
    features: [
      "Unlimited stories",
      "Unlimited interactive episodes",
      "HD image generation",
      "Advanced AI model",
      "Priority scenario generation",
      "Custom character scenarios",
      "Early access to new features",
      "Detailed reading analytics",
    ],
    cta: "Get Started",
    highlighted: true,
  },
];

const FAQ = [
  {
    q: "Can I switch plans at any time?",
    a: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
  },
  {
    q: "What happens when I hit my episode limit?",
    a: "On the Starter plan, you can still read published chapters and browse community scenarios. Interactive episode generation pauses until the next month or you upgrade.",
  },
  {
    q: "Is there a free trial?",
    a: "New accounts get 3 free interactive episodes to try the experience before choosing a plan.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, debit cards, and Apple Pay through our secure payment processor.",
  },
];

export default function PlansPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-5">
            <SparklesIcon className="w-7 h-7 text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Choose Your Plan</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Unlock interactive episodes, AI-generated scenes, and the full SourceNovel experience.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-20">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                tier.highlighted
                  ? "border-violet-500/40 bg-violet-500/[0.04] shadow-lg shadow-violet-500/10"
                  : "border-slate-800/60 bg-white/[0.02]"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-medium">
                  Most Popular
                </div>
              )}

              <h2 className="text-lg font-bold text-white mb-1">{tier.name}</h2>
              <p className="text-slate-500 text-xs mb-4">{tier.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-white">{tier.price}</span>
                <span className="text-slate-500 text-sm">{tier.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`w-full px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                  tier.highlighted
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
                    : "bg-white/5 border border-slate-700 hover:bg-white/10 text-white"
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div>
          <h2 className="text-lg font-bold text-white mb-6 text-center">Frequently Asked Questions</h2>
          <div className="space-y-2 max-w-xl mx-auto">
            {FAQ.map((item, i) => (
              <div key={i} className="border border-slate-800/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-medium text-slate-200 hover:bg-white/[0.02] transition-colors"
                >
                  {item.q}
                  <span className="text-slate-500 ml-4 flex-shrink-0">
                    {openFaq === i ? "−" : "+"}
                  </span>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
