"use client";

import React from "react";
import Link from "next/link";

type TagType = "PROJECT" | "GENERAL";

interface TagSummary {
  id: string;
  name: string;
  type: TagType;
  color: string;
  /** Populated only on short tags — routes the pill to the parent project page */
  parentProject?: { id: string } | null;
}

export interface TagDisplayProps {
  tags: TagSummary[];
  maxVisible?: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function TagDisplay({ tags, maxVisible = 3 }: TagDisplayProps) {
  const visible = tags.slice(0, maxVisible);
  const overflow = tags.length - maxVisible;

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((tag) => {
        const pillStyle = {
          backgroundColor: hexToRgba(tag.color, 0.2),
          border: `1px solid ${tag.color}`,
        };
        const pillClass =
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white";

        const isShortTag = !!tag.parentProject;

        if (isShortTag) {
          return (
            <Link
              key={tag.id}
              href={`/projects/${tag.parentProject!.id}`}
              className={`${pillClass} hover:brightness-125 transition-filter cursor-pointer`}
              style={pillStyle}
            >
              {tag.name}
              <span className="opacity-70">↗</span>
            </Link>
          );
        }

        return (
          <span
            key={tag.id}
            className={pillClass}
            style={pillStyle}
          >
            {tag.type === "PROJECT" && <span>📁</span>}
            {tag.name}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="inline-flex items-center rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-400">
          +{overflow} more
        </span>
      )}
    </div>
  );
}
