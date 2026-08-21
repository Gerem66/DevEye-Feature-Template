import { useEffect, useState } from 'react';
import { featureApi, settingsStyles as shell, SegmentedControl } from 'deveye-sdk-client';
import type { SettingsPanelProps } from 'deveye-types/sdk/client';

import { manifest } from '../manifest';

const api = featureApi(manifest);

const LEAD_OPTIONS = [
    { value: '0', label: 'À l’échéance' },
    { value: '60', label: '1 h avant' },
    { value: '1440', label: '1 jour avant' }
] as const;

/**
 * The panel behind the manifest's `settings.feature: ['general']` tab.
 * It receives the scope and the caller's write flag; DevEye renders it inside
 * the shared settings shell (left nav, title, sizing) so every feature's
 * settings look and behave the same.
 */
export default function GeneralPanel({ canWrite }: SettingsPanelProps) {
    const [lead, setLead] = useState('0');

    useEffect(() => {
        void api.send('x-countdown.list', {}).then((res) => setLead(String(res.settings.leadMinutes)));
    }, []);

    const save = (value: string): void => {
        setLead(value);
        void api.send('x-countdown.settingsSet', { leadMinutes: Number(value) });
    };

    return (
        <div className={shell.section}>
            <span className={shell.sectionLabel}>Notification</span>
            <p className={shell.sectionHint}>Quand prévenir, par rapport à l’échéance.</p>
            <SegmentedControl
                aria-label='Moment de la notification'
                value={lead}
                options={[...LEAD_OPTIONS]}
                onChange={canWrite ? save : () => undefined}
            />
        </div>
    );
}
