import { useEffect, useState } from 'react';
import {
    Button,
    featureApi,
    invalidate,
    SegmentedControl,
    settingsStyles as shell,
    useWorkspacePermissions
} from 'deveye-sdk-client';
import type { SettingsPanelProps } from '@deveye/types/sdk/client';

import { manifest } from '../manifest';

const api = featureApi(manifest);

const STEP_OPTIONS = [
    { value: '1', label: '+1' },
    { value: '5', label: '+5' },
    { value: '10', label: '+10' }
] as const;

/**
 * The panel behind the manifest's `settings.feature: ['general']` tab.
 * It receives the scope and the caller's write flag; DevEye renders it inside
 * the shared settings shell (left nav, title, sizing) so every feature's
 * settings look and behave the same.
 */
export default function GeneralPanel({ canWrite }: SettingsPanelProps) {
    // UI hides, the server authorizes: `reset` is the extra permission the
    // manifest declares, granted per role (the owner always has it).
    const canReset = useWorkspacePermissions().canExtra('x-counter', 'reset');
    const [step, setStep] = useState('1');

    useEffect(() => {
        void api.send('x-counter.state', {}).then((res) => setStep(String(res.step)));
    }, []);

    const save = (value: string): void => {
        setStep(value);
        void api
            .send('x-counter.stepSet', { step: Number(value) as 1 | 5 | 10 })
            .then(() => invalidate('x-counter.state'));
    };

    const reset = (): void => {
        void api.send('x-counter.reset', {}).then(() => invalidate('x-counter.state'));
    };

    return (
        <div className={shell.section}>
            <span className={shell.sectionLabel}>Pas du compteur</span>
            <p className={shell.sectionHint}>Combien chaque clic ajoute, pour tout l’espace.</p>
            <SegmentedControl
                aria-label='Pas du compteur'
                value={step}
                options={[...STEP_OPTIONS]}
                onChange={canWrite ? save : () => undefined}
            />

            {canReset && (
                <>
                    <span className={shell.sectionLabel}>Remise à zéro</span>
                    <p className={shell.sectionHint}>
                        Efface la valeur et le journal, pour tout le monde. L’action est tracée dans le journal d’audit.
                    </p>
                    <div className={shell.sectionActions}>
                        <Button variant='danger' onClick={reset}>
                            Remettre à zéro
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
