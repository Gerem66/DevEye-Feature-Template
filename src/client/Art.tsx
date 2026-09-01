/**
 * The vignette shown on your card in the add market and on your "About" sheet.
 *
 * The host supplies the frame (a 160 x 90 viewBox, useful area x 16 to 144), so
 * this returns SVG CHILDREN and no `<svg>`. Colours are theme variables, never
 * literals: an accent colour is per-workspace, and a hardcoded one ignores the
 * theme someone chose.
 *
 * Draw the SHAPE of your screen — here the big button and the journal under it
 * — rather than your icon enlarged: a market card is a preview, not a logo.
 */

const ACCENT = 'var(--accent)';
const MUTED = 'var(--text-muted)';

export default function CounterArt() {
    return (
        <>
            {/* The value, then THE button: what the screen is mostly made of. */}
            <rect x='60' y='10' width='40' height='14' rx='4' fill={ACCENT} opacity='0.85' />
            <rect x='52' y='30' width='56' height='18' rx='6' fill={ACCENT} opacity='0.2' />
            <path d='M80 34v10M75 39h10' stroke={ACCENT} strokeWidth='2.4' strokeLinecap='round' />

            {/* The journal: the same value twice, plain then sealed. */}
            <rect x='16' y='56' width='128' height='10' rx='3' fill={MUTED} opacity='0.12' />
            <rect x='22' y='59' width='18' height='4' rx='2' fill={MUTED} opacity='0.55' />
            <rect x='48' y='59' width='86' height='4' rx='2' fill={MUTED} opacity='0.25' />
            <rect x='16' y='70' width='128' height='10' rx='3' fill={MUTED} opacity='0.12' />
            <rect x='22' y='73' width='18' height='4' rx='2' fill={MUTED} opacity='0.55' />
            <rect x='48' y='73' width='72' height='4' rx='2' fill={MUTED} opacity='0.25' />
        </>
    );
}
