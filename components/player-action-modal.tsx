"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import type { SimAction } from "@/lib/simulation-types";

interface PlayerActionModalProps {
  characterSlug: string;
  characterName: string;
  characterImage: string;
  locationSlug: string;
  locationName: string;
  availableMoves: { slug: string; name: string; label: string }[];
  nearbyCharacters: { slug: string; name: string; mood: string }[];
  onConfirm: (action: SimAction) => void;
  onCancel: () => void;
}

type ActionType = "move" | "interact" | "speak" | "wait";

export function PlayerActionModal({
  characterSlug,
  characterName,
  characterImage,
  locationSlug,
  locationName,
  availableMoves,
  nearbyCharacters,
  onConfirm,
  onCancel,
}: PlayerActionModalProps) {
  const [actionType, setActionType] = useState<ActionType>("wait");
  const [moveTarget, setMoveTarget] = useState<string>(availableMoves[0]?.slug ?? "");
  const [interactTarget, setInteractTarget] = useState<string>(nearbyCharacters[0]?.slug ?? "");
  const [dialogue, setDialogue] = useState("");
  const [imageError, setImageError] = useState(false);
  const dialogueRef = useRef<HTMLTextAreaElement>(null);

  // Focus dialogue textarea when speak is selected
  useEffect(() => {
    if (actionType === "speak") {
      dialogueRef.current?.focus();
    }
  }, [actionType]);

  const handleConfirm = () => {
    let target: string | null = null;
    let targetLocation: string | undefined;
    let targetCharacter: string | undefined;
    let actionDetail: string = actionType;
    let narration = "";

    switch (actionType) {
      case "move":
        target = moveTarget;
        targetLocation = moveTarget;
        const moveLoc = availableMoves.find((m) => m.slug === moveTarget);
        actionDetail = `move → ${moveTarget}`;
        narration = `${characterName} sets off toward ${moveLoc?.name ?? moveTarget}.`;
        break;
      case "interact":
        target = interactTarget;
        targetCharacter = interactTarget;
        const interactChar = nearbyCharacters.find((c) => c.slug === interactTarget);
        actionDetail = `interact → ${interactTarget}`;
        narration = `${characterName} turns to ${interactChar?.name ?? interactTarget}.`;
        break;
      case "wait":
        actionDetail = "wait";
        narration = `${characterName} remains still, taking in the surroundings.`;
        break;
    }

    if (dialogue) {
      narration += ` "${dialogue.slice(0, 50)}${dialogue.length > 50 ? "..." : ""}"`;
    }

    const action: SimAction = {
      characterSlug,
      actionType,
      actionDetail,
      targetLocation,
      targetCharacter,
      dialogue: dialogue.trim() || undefined,
      narration,
      mood: "focused",
    };

    onConfirm(action);
  };

  const canConfirm = (() => {
    switch (actionType) {
      case "move": return !!moveTarget;
      case "interact": return !!interactTarget;
      case "wait": return true;
      default: return true;
    }
  })();

  const actions: { type: ActionType; label: string; description: string; disabled?: boolean }[] = [
    { type: "move", label: "Move", description: "Travel to a connected location" },
    { type: "interact", label: "Interact", description: "Engage with someone nearby", disabled: nearbyCharacters.length === 0 },
    { type: "wait", label: "Wait", description: "Observe and stay put" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="bg-[#0f0f18] border border-amber-500/20 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500/40 flex-shrink-0 relative">
              {!imageError ? (
                <Image
                  src={characterImage}
                  alt={characterName}
                  fill
                  className="object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{characterName.charAt(0)}</span>
                </div>
              )}
            </div>
            <div>
              <span className="text-[10px] uppercase tracking-widest text-amber-400">Your Turn</span>
              <h2 className="text-base font-semibold text-white">{characterName}</h2>
              <p className="text-xs text-slate-500">at {locationName}</p>
            </div>
          </div>
        </div>

        {/* Action selection */}
        <div className="p-6 space-y-5">
          {/* Action type */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">Action</label>
            <div className="grid grid-cols-3 gap-1.5">
              {actions.map((a) => (
                <button
                  key={a.type}
                  onClick={() => !a.disabled && setActionType(a.type)}
                  disabled={a.disabled}
                  className={`px-2 py-2 text-xs rounded-lg border transition-colors text-center ${
                    actionType === a.type
                      ? "bg-amber-500/15 border-amber-500/30 text-amber-200"
                      : a.disabled
                        ? "bg-white/[0.01] border-white/[0.04] text-slate-700 cursor-not-allowed"
                        : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  }`}
                  title={a.description}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>

          {/* Move targets */}
          {actionType === "move" && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">Destination</label>
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                {availableMoves.map((loc) => (
                  <button
                    key={loc.slug}
                    onClick={() => setMoveTarget(loc.slug)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      moveTarget === loc.slug
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-200"
                        : "bg-white/[0.02] border-white/[0.05] text-slate-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="font-medium">{loc.name}</span>
                    <span className="text-[10px] text-slate-500 ml-2">{loc.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interact targets */}
          {actionType === "interact" && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">Character</label>
              <div className="space-y-1.5">
                {nearbyCharacters.map((char) => (
                  <button
                    key={char.slug}
                    onClick={() => setInteractTarget(char.slug)}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                      interactTarget === char.slug
                        ? "bg-amber-500/10 border-amber-500/25 text-amber-200"
                        : "bg-white/[0.02] border-white/[0.05] text-slate-300 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="font-medium">{char.name}</span>
                    <span className="text-[10px] text-slate-500 ml-2">mood: {char.mood}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Dialogue */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 block">
              Dialogue (optional)
            </label>
            <textarea
              ref={dialogueRef}
              value={dialogue}
              onChange={(e) => setDialogue(e.target.value)}
              placeholder={
                actionType === "interact"
                  ? "What do you say to them?"
                  : "Say something as you go..."
              }
              className="w-full h-20 px-3 py-2 text-sm bg-white/[0.03] border border-white/10 rounded-lg text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              className="px-3 py-2 text-xs rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-5 py-2 text-xs font-medium rounded-lg bg-amber-600 border border-amber-500/50 text-white hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Confirm Action
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
