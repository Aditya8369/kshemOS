import { CONTAINER_VARIANTS } from '../../layoutStyles';

/**
 * Standardized Page Container Component.
 * Enforces responsive horizontal padding (px-4 sm:px-6 lg:px-8),
 * consistent max-widths by variant, and prevents viewport overflow.
 */
export default function PageContainer({
  variant = 'public',
  className = '',
  children,
  ...props
}) {
  const baseClasses = CONTAINER_VARIANTS[variant] || CONTAINER_VARIANTS.public;

  return (
    <div
      className={`${baseClasses} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

