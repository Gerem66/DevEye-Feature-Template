/**
 * Standalone typings for `deveye-sdk-client`.
 *
 * Inside DevEye, `deveye-sdk-client` is a real module the app provides (its
 * client SDK barrel), resolved by alias when your feature is compiled in. In
 * THIS repo there is no app, so this declaration mirrors the surface for
 * `tsc --noEmit`. It intentionally types the contract, not the pixels: if the
 * app's barrel gains members, extend this file the same way.
 */
declare module 'deveye-sdk-client' {
    import type { ComponentType, ReactNode, ChangeEvent, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';
    import type { z, ZodType } from 'zod';
    import type { FeatureAccess, FeatureId, WorkspaceCapability } from 'deveye-types';
    import type { FeatureManifest } from 'deveye-types/sdk';

    // ── UI kit ─────────────────────────────────────────────────────────────
    export const Button: ComponentType<
        ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; icon?: string }
    >;
    export const TextInput: ComponentType<InputHTMLAttributes<HTMLInputElement> & { enableShowHideButton?: boolean }>;
    export const SelectInput: ComponentType<SelectHTMLAttributes<HTMLSelectElement>>;
    export const Checkbox: ComponentType<{
        checked: boolean;
        onChange: () => void;
        children?: ReactNode;
        disabled?: boolean;
        className?: string;
    }>;
    export const Switch: ComponentType<{
        checked: boolean;
        onChange: (next: boolean) => void;
        label: string;
        hint?: string;
        disabled?: boolean;
    }>;
    export function SegmentedControl<T extends string>(props: {
        value: T;
        options: readonly { value: T; label: string; title?: string }[];
        onChange: (value: T) => void;
        'aria-label'?: string;
        disabled?: boolean;
    }): ReactNode;
    export const Dialog: ComponentType<{
        open: boolean;
        onClose: () => void;
        title?: string;
        description?: ReactNode;
        children?: ReactNode;
        footer?: ReactNode;
        width?: number;
        onSubmit?: () => void;
        fill?: boolean;
        holdSecrecy?: boolean;
    }>;
    export const StatusBadge: ComponentType<{ tone?: string; dot?: boolean; children?: ReactNode; className?: string }>;
    export const ConfirmDialog: ComponentType<Record<string, unknown>>;
    export const FeatureSettingsButton: ComponentType<{
        scope: { kind: 'feature'; feature: FeatureId } | { kind: 'item'; feature: FeatureId; itemId: number; itemLabel: string };
        variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
        label?: string;
    }>;
    /** The canonical settings row classes (channelRow, field, sectionHint...). */
    export const settingsStyles: Readonly<Record<string, string>>;

    // ── Data ───────────────────────────────────────────────────────────────
    export function useResource<T>(
        key: string,
        load: () => Promise<T>,
        fallback: string,
        deps?: readonly unknown[]
    ): { data: T | null; error: string | null; loading: boolean; reload: () => void };
    export function invalidate(...keys: string[]): void;
    export function useResourceVersion(key: string): number;
    export function humanizeError(error: unknown, fallback: string): string;
    export function featureApi<const M extends FeatureManifest>(manifest: M): {
        send<N extends M['commands'][number]['command']>(
            name: N,
            input: z.input<Extract<M['commands'][number], { command: N }>['input'] & ZodType>
        ): Promise<z.output<Extract<M['commands'][number], { command: N }>['output'] & ZodType>>;
    };

    // ── Live ───────────────────────────────────────────────────────────────
    export type LiveSegmentKind = 'view' | 'l1' | 'l2' | 'l3' | 'l4';
    export function useLiveSegment(kind: LiveSegmentKind, value: string | null): { value: string | null } | null;
    export function useLiveOutline(kind: LiveSegmentKind, value: string | null): Record<string, unknown>;
    export function useLiveOutlines(kind: LiveSegmentKind): (value: string | null) => Record<string, unknown>;
    export function useLiveItemTarget(
        kind: LiveSegmentKind,
        value: string | null,
        ready: boolean,
        onTarget: (value: string | null) => void
    ): void;
    export function useTypers(): { connId: string; userId: number }[];
    export function useTypingSignal(): { onInput: () => void; stop: () => void };

    // ── Rights and workspace ───────────────────────────────────────────────
    export function useWorkspacePermissions(): {
        isOwner: boolean;
        can: (c: WorkspaceCapability) => boolean;
        canFeature: (f: FeatureId, level?: FeatureAccess) => boolean;
        canChannels: (f: FeatureId) => boolean;
        canExtra: (f: FeatureId, key: string) => boolean;
        extraValue: (f: FeatureId, key: string, spec: { default: string; ownerValue: string }) => string;
    };
    export function useActiveWorkspace(): { id: number; kind: 'personal' | 'shared'; name: string } | null;
    export function useFeatureLifecycle(hooks: { onUnmount?: () => void }): void;

    // Change events re-exported for convenience in handlers.
    export type InputChange = ChangeEvent<HTMLInputElement>;
}
