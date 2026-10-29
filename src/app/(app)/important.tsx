/**
 * The mark for an application flagged as important (from Career Clipper or Career Engine's star).
 * An SVG, not ★: Windows may draw that character from its colour emoji font.
 */
export function StarIcon({ className = '' }: { className?: string }) {
    return (
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-4 shrink-0 fill-current ${className}`}>
            <path d="M10 1.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L10 14.9l-5.25 2.75 1-5.85L1.5 7.7l5.9-.9z" />
        </svg>
    );
}

export function ImportantBadge() {
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-300">
            <StarIcon className="size-3" />
            Important
        </span>
    );
}
