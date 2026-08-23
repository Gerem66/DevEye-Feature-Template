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

    // ── Server push events ─────────────────────────────────────────────────
    /** Typed push subscription: filters `event`, safeParses, drops mismatches. */
    export function onServerEvent<T>(event: string, schema: ZodType<T>, cb: (payload: T) => void): () => void;
    /** Fires now if the socket is open, then on every reopen (resubscribe primitive). */
    export function onSocketOpen(cb: () => void): () => void;
    /** Whether the socket is open right now (to tell a real error from an outage). */
    export function isSocketOpen(): boolean;

    // ── Data ───────────────────────────────────────────────────────────────
    export function useResource<T>(
        key: string,
        load: () => Promise<T>,
        fallback: string,
        deps?: readonly unknown[]
    ): { data: T | null; error: string | null; loading: boolean; reload: () => void };
    export function invalidate(...keys: string[]): void;
    export function useResourceVersion(key: string): number;
    /** Imperative subscription to one resource key's invalidations. Returns the unsubscribe. */
    export function onResourceChange(key: string, cb: () => void): () => void;
    export function humanizeError(error: unknown, fallback: string): string;
    export function featureApi<const M extends FeatureManifest>(manifest: M): {
        send<N extends M['commands'][number]['command']>(
            name: N,
            input: z.input<Extract<M['commands'][number], { command: N }>['input'] & ZodType>,
            /** `timeoutMs` stretches the wait for a command that queries a slow third party. */
            opts?: { timeoutMs?: number }
        ): Promise<z.output<Extract<M['commands'][number], { command: N }>['output'] & ZodType>>;
    };

    // ── Password-based encryption (secrecy) ────────────────────────────────
    // The surface any feature needs when one of its commands can answer
    // `locked` (contracts stored with `'private'` encryption server-side).
    export interface SecrecyState {
        /** True when password-based encryption is enabled for the account. */
        enabled: boolean;
        /** True while the session holds the unlocked key. */
        unlocked: boolean;
    }
    /** Live lock state of the session (shared with the topbar widget and the global prompt). */
    export function useSecrecy(): SecrecyState;
    /** Resolves once the session is unlocked, opening the global prompt if needed. Rejects on cancel. */
    export function ensureSecrecyUnlocked(): Promise<void>;
    /** Runs `run`; on a `locked` error, opens the unlock prompt and retries once. */
    export function withSecrecy<T>(run: () => Promise<T>): Promise<T>;

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

    // ── Shared helpers ─────────────────────────────────────────────────────
    /** Byte size with French units (o / Ko / Mo / Go). */
    export function formatBytesFr(bytes: number): string;
    /** Folder picker over an enrolled device's filesystem (shared with Backup). */
    export const DeviceFolderPicker: ComponentType<Record<string, unknown>>;
    /** The workspace's enrolled devices, live. */
    export function useDevices(): { id: string; name: string; online: boolean }[];
    export interface LiveOutlineProps {
        'data-live-peer'?: true;
        style?: Record<string, unknown>;
    }

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
