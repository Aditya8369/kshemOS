import { HEADER_TYPOGRAPHY, CARD_SURFACES } from '../../layoutStyles';

/**
 * Standardized Page Header Component.
 * Formats eyebrow labels, page titles, descriptions, and action slots
 * across 'card', 'hero', 'tool', and 'officer' visual variants.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  actions,
  variant = 'card', // 'card' | 'hero' | 'tool' | 'officer' | 'unboxed'
  className = '',
  icon: Icon
}) {
  const isHero = variant === 'hero';
  const isOfficer = variant === 'officer';
  const isTool = variant === 'tool';
  const isUnboxed = variant === 'unboxed';

  const titleClass = isHero
    ? HEADER_TYPOGRAPHY.titleHero
    : isOfficer
    ? HEADER_TYPOGRAPHY.titleOfficer
    : isTool
    ? HEADER_TYPOGRAPHY.titleTool
    : HEADER_TYPOGRAPHY.title;

  const descClass = isHero
    ? HEADER_TYPOGRAPHY.descriptionHero
    : isOfficer
    ? HEADER_TYPOGRAPHY.descriptionOfficer
    : isTool
    ? HEADER_TYPOGRAPHY.descriptionTool
    : HEADER_TYPOGRAPHY.description;

  const eyebrowClass = isOfficer
    ? HEADER_TYPOGRAPHY.eyebrowOfficer
    : HEADER_TYPOGRAPHY.eyebrow;

  const containerClasses = isHero
    ? CARD_SURFACES.hero
    : isOfficer
    ? 'space-y-3'
    : isTool
    ? 'space-y-2 mb-6'
    : isUnboxed
    ? 'space-y-3'
    : 'rounded-3xl border border-[var(--paper-line)] bg-white p-6 sm:p-10 shadow-xs relative overflow-hidden space-y-3';

  return (
    <header className={`${containerClasses} ${className}`.trim()}>
      {/* Background ambient blur for card/hero variants */}
      {(variant === 'card' || isHero) && (
        <div
          className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-amber-100/40 via-orange-50/20 to-transparent rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"
          aria-hidden="true"
        />
      )}

      <div className="relative z-10 max-w-3xl space-y-2">
        {/* Eyebrow and Optional Badge */}
        {(eyebrow || badge || Icon) && (
          <div className="flex flex-wrap items-center gap-2">
            {Icon && <Icon className="w-4 h-4 text-[var(--saffron)]" aria-hidden="true" />}
            {eyebrow && <span className={eyebrowClass}>{eyebrow}</span>}
            {badge && <span>{badge}</span>}
          </div>
        )}

        {/* Page Title (Semantic H1) */}
        {title && <h1 className={titleClass}>{title}</h1>}

        {/* Description */}
        {description && (
          <p className={descClass}>
            {description}
          </p>
        )}

        {/* Actions Slot */}
        {actions && (
          <div className="pt-2 flex flex-wrap items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

