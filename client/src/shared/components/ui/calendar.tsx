"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-2", className)}
      classNames={{
        months: "flex flex-col gap-2 sm:flex-row sm:gap-2",
        month: "relative space-y-2",
        month_caption: "relative flex h-8 items-center justify-center px-7",
        caption_label: "text-xs font-semibold leading-none",
        nav: "absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between px-0.5",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "size-6 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "size-6 bg-transparent p-0 opacity-60 hover:opacity-100"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "text-muted-foreground w-8 rounded-md font-normal text-[0.7rem]",
        week: "mt-1 flex w-full",
        day: cn(
          "relative p-0 text-center text-xs focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 text-xs font-normal aria-selected:opacity-100"
        ),
        range_start:
          "aria-selected:bg-primary aria-selected:text-primary-foreground",
        range_end:
          "aria-selected:bg-primary aria-selected:text-primary-foreground",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "text-muted-foreground opacity-55 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={
        {
          Chevron: ({ orientation, className, ...props }: any) => (
            orientation === "left" ? (
              <ChevronLeft className={cn("size-4", className)} {...props} />
            ) : (
              <ChevronRight className={cn("size-4", className)} {...props} />
            )
          ),
        } as any
      }
      {...props}
    />
  );
}

export { Calendar };
