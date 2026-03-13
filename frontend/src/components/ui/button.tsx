import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary-800 active:scale-95 shadow-sm',
        accent: 'bg-accent text-white hover:bg-accent-700 active:scale-95 shadow-sm',
        success: 'bg-success text-white hover:bg-success/90 active:scale-95 shadow-sm',
        outline: 'border-2 border-primary text-primary hover:bg-primary-50 active:scale-95',
        ghost: 'text-primary hover:bg-primary-50 hover:text-primary-800',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2 text-sm',
        sm: 'h-8 px-4 py-1.5 text-xs',
        lg: 'h-12 px-6 py-3 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
