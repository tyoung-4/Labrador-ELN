"use client";

import React from "react";

export interface TagAssignmentSummary {
  tagId: string;
  tag: { id: string; name: string; type: string; color: string };
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex ?? "#888888").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) || 128;
  const g = parseInt(clean.substring(2, 4), 16) || 128;
  const b = parseInt(clean.substring(4, 6), 16) || 128;
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function InlineTagPills({
  tagAssignments,
}: {
  tagAssignments: TagAssignmentSummary[] | undefined | null;
}) {
  if (!tagAssignments || tagAssignments.length === 0) return null;
  return (
    <>
      {tagAssignments.map(({ tagId, tag }) => (
        <span
          key={tagId}
          className="text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-none flex-shrink-0"
          style={{
            backgroundColor: hexToRgba(tag.color, 0.18),
            border: `1px solid ${tag.color}`,
            color: tag.color,
          }}
        >
          {tag.type === "PROJECT" ? "📁 " : ""}
          {tag.name}
        </span>
      ))}
    </>
  );
}
