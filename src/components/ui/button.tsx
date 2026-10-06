import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Larger touch targets + clearer focus for elderly-friendly usage
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-base font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] cursor-pointer select-none",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white shadow hover:bg-indigo-700 active:bg-indigo-800 shadow-indigo-500/20",
        destructive:
          "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 shadow-rose-500/20",
        outline:
          "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100",
        secondary:
          "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700",
        ghost:
          "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300",
        link: "text-indigo-600 dark:text-indigo-400 underline-offset-4 hover:underline",
        emerald:
          "bg-emerald-600 text-white shadow hover:bg-emerald-700 active:bg-emerald-800 shadow-emerald-500/20",
        amber:
          "bg-amber-600 text-white shadow hover:bg-amber-700 active:bg-amber-800 shadow-amber-500/20",
      },
      size: {
        default: "h-12 px-5 py-3",
        sm: "h-10 rounded-lg px-4 text-sm",
        lg: "h-14 rounded-2xl px-8 text-lg font-bold",
        icon: "h-12 w-12 p-0 flex items-center justify-center",
        "icon-sm": "h-10 w-10 p-0 flex items-center justify-center",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
