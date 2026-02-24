"use client";

import { SignedIn, SignedOut, RedirectToSignIn, UserButton } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";
import { SparklesIcon } from "@heroicons/react/24/outline";

function TokenDisplay() {
  const tokenBalance = useQuery(api.users.getTokenBalance);

  return (
    <div className="rounded-2xl border border-slate-800/60 bg-white/[0.02] p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
          <SparklesIcon className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">Token Balance</p>
          <p className="text-xs text-slate-500">Used for interactive episodes</p>
        </div>
      </div>
      <p className="text-4xl font-bold text-white">
        {tokenBalance ?? "—"}
      </p>
      <p className="text-xs text-slate-500 mt-1">tokens remaining</p>
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

export default function AccountPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>

      <SignedIn>
        <SyncUser />
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-white">Account</h1>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "w-10 h-10",
                },
              }}
            />
          </div>
          <TokenDisplay />
        </div>
      </SignedIn>
    </div>
  );
}
