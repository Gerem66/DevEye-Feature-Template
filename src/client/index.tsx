import type { FeatureClient } from 'deveye-types/sdk/client';

import CountdownFull, { CountdownWidget } from './Countdown';
import GeneralPanel from './GeneralPanel';

/**
 * The client entry DevEye's generated glue imports: the card, the full view,
 * and one panel per settings tab that needs one ('notifications' is generic,
 * DevEye renders it for you from the manifest).
 */
export const clientEntry: FeatureClient = {
    Widget: CountdownWidget,
    Full: CountdownFull,
    settingsPanels: { general: GeneralPanel },
    cacheDurationMinutes: 10
};
