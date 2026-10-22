import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";
import type * as React from "react";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Lime is for the one main action on a screen
        default: "bg-lime text-ink shadow-glow hover:bg-[#b9e82a]",
        secondary: "border-line bg-panel text-ink hover:border-[#d6d6cd] hover:bg-wash",
        ink: "bg-ink text-white hover:bg-[#262626]",
        ghost: "text-ink-2 hover:bg-wash hover:text-ink aria-expanded:bg-wash",
        destructive: "text-red-ink hover:bg-red-soft focus-visible:ring-red/30",
        link: "h-auto px-0 text-teal-ink underline-offset-4 hover:underline",
        // shadcn internals (dialogs, menus) ask for "outline"
        outline: "border-line bg-panel text-ink hover:bg-wash",
      },
      size: {
        default: "h-10 px-4",
        sm: "h-8 gap-1.5 px-3 text-small",
        lg: "h-12 px-6 text-body",
        icon: "size-10",
        "icon-sm": "size-8",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        xs: "h-6 gap-1 rounded-md px-2 text-label",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
