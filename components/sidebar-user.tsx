"use client";

import { useEffect } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton, useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BoltIcon } from "@heroicons/react/24/outline";

function TokenBadge() {
  const tokens = useQuery(api.users.getTokenBalance);
  return (
    <div className="flex items-center gap-1.5">
      <BoltIcon className="w-3.5 h-3.5 text-violet-400" />
      <span className="text-xs text-slate-400">
        <span className="text-white font-semibold">{tokens ?? "—"}</span> tokens
      </span>
    </div>
  );
}

function SyncUser() {
  const { user } = useUser();
  const createOrGetUser = useMutation(api.users.createOrGetUser);

  useEffect(() => {
    if (!user) return;
    createOrGetUser({
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name: user.fullName ?? user.firstName ?? "User",
      imageUrl: user.imageUrl,
    });
  }, [user, createOrGetUser]);

  return null;
}

function UserSkeleton() {
  return (
    <div className="px-5 pb-3 pt-1">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-800 animate-pulse" />
        <div className="flex items-center gap-1.5">
          <div className="w-3.5 h-3.5 rounded bg-slate-800 animate-pulse" />
          <div className="w-16 h-3 rounded bg-slate-800 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function SidebarUser({ onNavigate }: { onNavigate?: () => void }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <>
        <UserSkeleton />
        <div className="mx-4 mb-3 h-px bg-slate-800/60" />
      </>
    );
  }

  return (
    <>
      <SignedIn>
        <SyncUser />
        <div className="px-5 pb-3 pt-1">
          <div className="flex items-center gap-3">
            <UserButton
              appearance={{
                elements: { avatarBox: "w-9 h-9" },
              }}
            />
            <TokenBadge />
          </div>
        </div>
        <div className="mx-4 mb-3 h-px bg-slate-800/60" />
      </SignedIn>

      <SignedOut>
        <div className="px-4 pb-3 pt-1">
          <Link
            href="/sign-in"
            onClick={onNavigate}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white transition-all"
          >
            Sign In
          </Link>
        </div>
        <div className="mx-4 mb-3 h-px bg-slate-800/60" />
      </SignedOut>
    </>
  );
}
