"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  SparklesIcon,
  UserCircleIcon,
  QuestionMarkCircleIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const NAV_ITEMS = [
  { label: "Home", href: "/", icon: HomeIcon },
  { label: "Plans", href: "/plans", icon: SparklesIcon },
  { label: "Account", href: "/account", icon: UserCircleIcon },
  { label: "Help & FAQ", href: "/help", icon: QuestionMarkCircleIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navContent = (
    <nav className="flex flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              active
                ? "bg-violet-500/15 text-violet-300 border border-violet-500/20"
                : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 border-r border-slate-800/50 bg-[#0a0a0f] h-screen sticky top-0 z-30">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6">
          <img src="/source-novel-icon.png" alt="SourceNovel" className="w-8 h-8 rounded-lg" />
          <div>
            <p className="text-sm font-bold text-white">SourceNovel</p>
            <p className="text-[10px] text-slate-500">Generative Fiction</p>
          </div>
        </div>

        {navContent}

        {/* Premium banner */}
        <div className="mt-auto px-3 pb-5">
          <Link
            href="/plans"
            onClick={() => setMobileOpen(false)}
            className="block rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/10 border border-violet-500/20 p-4 hover:border-violet-500/40 transition-colors"
          >
            <SparklesIcon className="w-5 h-5 text-violet-400 mb-2" />
            <p className="text-sm font-semibold text-white mb-0.5">Go Premium</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">Unlimited episodes & HD images from $7.99/mo</p>
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-slate-800/50">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
        >
          <Bars3Icon className="w-5 h-5" />
        </button>
        <img src="/source-novel-icon.png" alt="SourceNovel" className="w-6 h-6 rounded-md" />
        <p className="text-sm font-bold text-white">SourceNovel</p>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-[#0a0a0f] border-r border-slate-800/50 flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 py-6">
              <div className="flex items-center gap-3">
                <img src="/source-novel-icon.png" alt="SourceNovel" className="w-8 h-8 rounded-lg" />
                <p className="text-sm font-bold text-white">SourceNovel</p>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            {navContent}

            {/* Premium banner */}
            <div className="mt-auto px-3 pb-5">
              <Link
                href="/plans"
                onClick={() => setMobileOpen(false)}
                className="block rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/10 border border-violet-500/20 p-4 hover:border-violet-500/40 transition-colors"
              >
                <SparklesIcon className="w-5 h-5 text-violet-400 mb-2" />
                <p className="text-sm font-semibold text-white mb-0.5">Go Premium</p>
                <p className="text-[11px] text-slate-400 leading-relaxed">Unlimited episodes & HD images from $7.99/mo</p>
              </Link>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
