import React, { memo } from "react";

interface TypingUser {
  userId: string;
  userName?: string;
}

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export const TypingIndicator = memo(function TypingIndicator({
  typingUsers,
}: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const names = typingUsers
    .map((u) => u.userName || u.userId.slice(0, 8))
    .slice(0, 3);
  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names[0]} and ${names.length - 1} others are typing`;

  return (
    <div className="px-4 py-1 text-xs text-slate-400 animate-pulse">
      <span className="inline-flex items-center gap-1">
        <span className="flex gap-0.5">
          <span className="h-1 w-1 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
          <span className="h-1 w-1 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
          <span className="h-1 w-1 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
        </span>
        {text}
      </span>
    </div>
  );
});
