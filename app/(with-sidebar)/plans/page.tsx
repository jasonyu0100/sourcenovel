"use client";

import { useState } from "react";
import { BoltIcon } from "@heroicons/react/24/outline";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

const PACKS = [
  {
    name: "Starter",
    tokens: 50,
    price: "$4.99",
    perToken: "$0.10",
    description: "Try a few interactive episodes.",
    highlighted: false,
  },
  {
    name: "Explorer",
    tokens: 150,
    price: "$9.99",
    perToken: "$0.07",
    savings: "Save 33%",
    description: "Enough for several full story arcs.",
    highlighted: true,
  },
  {
    name: "Adventurer",
    tokens: 500,
    price: "$24.99",
    perToken: "$0.05",
    savings: "Save 50%",
    description: "For dedicated readers who can't stop.",
    highlighted: false,
  },
];

const FAQ = [
  {
    q: "What are tokens?",
    a: "Each token powers one interaction in an interactive episode — choosing an action, writing a custom response, or continuing the story. Reading published chapters and browsing the library is always free.",
  },
  {
    q: "Do tokens expire?",
    a: "No. Tokens stay in your account until you use them. Buy once, use whenever.",
  },
  {
    q: "Do I get any free tokens?",
    a: "Yes — every new account starts with 20 free tokens so you can try the interactive experience.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit cards, debit cards, and Apple Pay through our secure payment processor.",
  },
];

function CurrentBalance() {
  const tokens = useQuery(api.users.getTokenBalance);
  return (
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/[0.08] mb-8">
      <BoltIcon className="w-4 h-4 text-violet-400" />
      <span className="text-sm text-slate-300">
        Your balance: <span className="text-white font-semibold">{tokens ?? "—"}</span> tokens
      </span>
    </div>
  );
}

export default function PlansPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 mb-5">
            <BoltIcon className="w-7 h-7 text-violet-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Get Tokens</h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            Tokens power interactive episodes. Each interaction costs 1 token. Reading chapters is always free.
          </p>

          <SignedIn>
            <div className="mt-6">
              <CurrentBalance />
            </div>
          </SignedIn>
        </div>

        {/* Coming soon notice */}
        <div className="mb-8 px-5 py-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] text-center">
          <p className="text-amber-300/90 text-sm font-medium">Token refills are coming soon</p>
          <p className="text-amber-300/40 text-xs mt-1">Purchasing is not yet available. New accounts start with 20 free tokens.</p>
        </div>

        {/* Token Packs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20 opacity-50 pointer-events-none select-none">
          {PACKS.map((pack) => (
            <div
              key={pack.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${
                pack.highlighted
                  ? "border-violet-500/40 bg-violet-500/[0.04] shadow-lg shadow-violet-500/10"
                  : "border-slate-800/60 bg-white/[0.02]"
              }`}
            >
              {pack.savings && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-violet-600 text-white text-xs font-medium">
                  {pack.savings}
                </div>
              )}

              <h2 className="text-lg font-bold text-white mb-1">{pack.name}</h2>
              <p className="text-slate-500 text-xs mb-4">{pack.description}</p>

              <div className="flex items-center gap-3 mb-2">
                <BoltIcon className="w-5 h-5 text-violet-400" />
                <span className="text-2xl font-bold text-white">{pack.tokens}</span>
                <span className="text-slate-500 text-sm">tokens</span>
              </div>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-3xl font-bold text-white">{pack.price}</span>
                <span className="text-slate-500 text-sm">({pack.perToken}/token)</span>
              </div>

              <div className="mt-auto">
                <SignedIn>
                  <button
                    className={`w-full px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                      pack.highlighted
                        ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
                        : "bg-white/5 border border-slate-700 hover:bg-white/10 text-white"
                    }`}
                  >
                    Buy {pack.name}
                  </button>
                </SignedIn>
                <SignedOut>
                  <Link
                    href="/sign-in"
                    className={`block text-center w-full px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                      pack.highlighted
                        ? "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white"
                        : "bg-white/5 border border-slate-700 hover:bg-white/10 text-white"
                    }`}
                  >
                    Sign in to buy
                  </Link>
                </SignedOut>
              </div>
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
