import { useState } from 'react';
import { Button, featureApi, invalidate, TextInput, useResource, useWorkspacePermissions } from 'deveye-sdk-client';

import { manifest } from '../manifest';
import type { Countdown } from '../contracts/domain';
import styles from './style.module.css';

/** Typed sends for THIS feature's commands, straight from the manifest. */
const api = featureApi(manifest);

function whenLabel(at: number): string {
    return new Date(at * 1000).toLocaleString();
}

/**
 * The data hook, shared by the card and the full view: one cache key, three
 * refresh triggers (mount, socket reconnect, invalidation). No polling: when
 * anyone in the workspace writes, the server broadcasts your feature's topic
 * and every declared resource re-fetches.
 */
function useCountdowns() {
    return useResource(
        'x-countdown.list',
        async () => (await api.send('x-countdown.list', {})).countdowns,
        'Deadlines could not be loaded.'
    );
}

/** The card body on the home grid. No props: data comes from the hook. */
export function CountdownWidget() {
    const { data } = useCountdowns();
    const next = (data ?? []).filter((c) => !c.notified).sort((a, b) => a.at - b.at)[0];
    if (!next) return <p className={styles.empty}>No deadline.</p>;
    return (
        <div>
            <div className={styles.widgetNext}>{next.label}</div>
            <div className={styles.when}>{whenLabel(next.at)}</div>
        </div>
    );
}

function Row({ countdown, canManage }: { countdown: Countdown; canManage: boolean }) {
    const due = countdown.at * 1000 <= Date.now();
    return (
        <div className={styles.row}>
            <span className={styles.label}>{countdown.label}</span>
            <span className={`${styles.when} ${due ? styles.due : ''}`}>{whenLabel(countdown.at)}</span>
            {canManage && (
                <Button
                    variant='ghost'
                    onClick={() =>
                        void api.send('x-countdown.remove', { id: countdown.id }).then(() => invalidate('x-countdown.list'))
                    }
                >
                    Retirer
                </Button>
            )}
        </div>
    );
}

/** The full view, opened when the card expands. */
export default function CountdownFull() {
    const { data, error } = useCountdowns();
    // UI hides, the server authorizes: `manageDeadlines` is the extra
    // permission the manifest declares, granted per role.
    const canManage = useWorkspacePermissions().canExtra('x-countdown', 'manageDeadlines');
    const [label, setLabel] = useState('');
    const [when, setWhen] = useState('');

    const add = async (): Promise<void> => {
        const at = Math.floor(new Date(when).getTime() / 1000);
        if (!label.trim() || !Number.isFinite(at) || at <= 0) return;
        await api.send('x-countdown.add', { label: label.trim(), at });
        setLabel('');
        setWhen('');
        // Local invalidation refreshes this tab instantly; other members get
        // the same refresh through the live topic.
        invalidate('x-countdown.list');
    };

    return (
        <div className={styles.list}>
            {error && <p className={styles.empty}>{error}</p>}
            {(data ?? []).map((c) => (
                <Row key={c.id} countdown={c} canManage={canManage} />
            ))}
            {data?.length === 0 && <p className={styles.empty}>No deadline yet.</p>}
            {canManage && (
                <div className={styles.form}>
                    <TextInput placeholder='Label' value={label} onChange={(e) => setLabel(e.target.value)} />
                    <TextInput type='datetime-local' value={when} onChange={(e) => setWhen(e.target.value)} />
                    <Button onClick={() => void add()} disabled={!label.trim() || !when}>
                        Ajouter
                    </Button>
                </div>
            )}
        </div>
    );
}
