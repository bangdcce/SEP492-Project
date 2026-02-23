"use client";

import * as React from "react";
import { GripVerticalIcon } from "lucide-react";
import {
  Group as ResizableGroup,
  Panel as ResizablePrimitivePanel,
  Separator as ResizablePrimitiveSeparator,
} from "react-resizable-panels";

import { cn } from "./utils";

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizableGroup>) {
  return (
    <ResizableGroup
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full", className)}
      {...props}
    />
  );
}

function ResizablePanel({
  ...props
}: React.ComponentProps<typeof ResizablePrimitivePanel>) {
  return <ResizablePrimitivePanel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitiveSeparator> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitiveSeparator
      data-slot="resizable-handle"
      className={cn(
        "group bg-border/90 data-[separator=hover]:bg-teal-300 data-[separator=active]:bg-teal-500 relative flex shrink-0 items-center justify-center transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none after:absolute aria-[orientation=vertical]:h-full aria-[orientation=vertical]:w-1 aria-[orientation=vertical]:after:inset-y-0 aria-[orientation=vertical]:after:left-1/2 aria-[orientation=vertical]:after:w-2 aria-[orientation=vertical]:after:-translate-x-1/2 aria-[orientation=horizontal]:h-1 aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:inset-x-0 aria-[orientation=horizontal]:after:top-1/2 aria-[orientation=horizontal]:after:h-2 aria-[orientation=horizontal]:after:-translate-y-1/2 aria-[orientation=horizontal]:[&>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-5 w-4 items-center justify-center rounded-sm border border-slate-300 bg-white text-slate-500 shadow-sm transition-colors group-data-[separator=active]:border-teal-500 group-data-[separator=active]:text-teal-600">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitiveSeparator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
