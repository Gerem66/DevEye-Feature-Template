import { useState } from 'react';
import {
    featureApi,
    FeatureSettingsButton,
    humanizeError,
    invalidate,
    useResource,
    useWorkspacePermissions
} from 'deveye-sdk-client';

import { manifest } from '../manifest';
import styles from './style.module.css';

/** Typed sends for THIS feature's commands, straight from the manifest. */
const api = featureApi(manifest);

/**
 * The data hook, shared by the card and the full view: one cache key, three
 * refresh triggers (mount, socket reconnect, invalidation). No polling: when
 * anyone in the workspace clicks, the server broadcasts your feature's topic
 * and every declared resource re-fetches: the counter moves on their screen
 * AND on yours.
 */
function useCounter() {
    return useResource('x-counter.state', () => api.send('x-counter.state', {}), 'Le compteur est injoignable.');
}

/** The card body on the home grid. No props: data comes from the hook. */
export function CounterWidget() {
    const { data } = useCounter();
    return (
        <div className={styles.widget}>
            <span className={styles.widgetValue}>{data?.value ?? '…'}</span>
            <span className={styles.widgetHint}>
                {data && data.clicks.length > 0
                    ? `dernier clic ${new Date(data.clicks[0].at).toLocaleTimeString()}`
                    : 'aucun clic'}
            </span>
        </div>
    );
}

function whenLabel(at: number): string {
    return new Date(at).toLocaleTimeString();
}

/** The full view, opened when the card expands. */
export default function CounterFull() {
    const { data, error } = useCounter();
    // UI hides, the server authorizes: without `write` the button is not
    // rendered, and had it been, the dispatcher would refuse the command.
    const canWrite = useWorkspacePermissions().canFeature('x-counter', 'write');
    const [busy, setBusy] = useState(false);
    const [clickError, setClickError] = useState<string | null>(null);

    const bump = async (): Promise<void> => {
        setBusy(true);
        setClickError(null);
        try {
            // The increment happens SERVER-side: the response carries the new
            // value, and two members clicking at once both land (no lost
            // update, unlike a client-computed `value + 1` sent back).
            await api.send('x-counter.increment', {});
            // Local invalidation refreshes this tab instantly; other members
            // get the same refresh through the live topic.
            invalidate('x-counter.state');
        } catch (e) {
            setClickError(humanizeError(e, 'Le clic n’a pas abouti.'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={styles.root}>
            {/* The header every feature shares: the title on the left, the
                actions on the right, among them the standard settings button.
                It opens the shared settings shell (our General tab lives in
                GeneralPanel.tsx) and renders nothing when the caller can read
                no tab: that rule lives in the shell, not here. */}
            <div className={styles.header}>
                <h2 className={styles.title}>{manifest.label}</h2>
                <FeatureSettingsButton scope={{ kind: 'feature', feature: 'x-counter' }} />
            </div>

            {error && <p className={styles.empty}>{error}</p>}

            <div className={styles.hero}>
                <span className={styles.value}>{data?.value ?? '…'}</span>
                {canWrite && (
                    <button
                        type='button'
                        className={styles.bigButton}
                        onClick={() => void bump()}
                        disabled={busy || data === null}
                    >
                        +{data?.step ?? 1}
                    </button>
                )}
                {clickError && <p className={styles.clickError}>{clickError}</p>}
            </div>

            {/* The journal this example exists for: the same value twice,
                decrypted server-side on the left, and on the right the very
                blob sitting in storage. */}
            {data && data.clicks.length > 0 && (
                <table className={styles.journal}>
                    <thead>
                        <tr>
                            <th>Heure</th>
                            <th>Valeur</th>
                            <th>La même, chiffrée (telle qu’en base)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.clicks.map((click) => (
                            <tr key={click.at}>
                                <td className={styles.when}>{whenLabel(click.at)}</td>
                                <td className={styles.plain}>{click.value}</td>
                                <td>
                                    <code className={styles.sealed} title={click.sealed}>
                                        {click.sealed}
                                    </code>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
            {data && data.clicks.length === 0 && <p className={styles.empty}>Aucun clic pour l’instant.</p>}
        </div>
    );
}
