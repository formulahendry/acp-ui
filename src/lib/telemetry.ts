// Azure Application Insights telemetry wrapper
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { getMachineId } from './tauri';

let appInsights: ApplicationInsights | null = null;
let isEnabled = true;
let machineId: string | null = null;

const CONNECTION_STRING = 'InstrumentationKey=70b098b2-fcae-4834-867f-69554662910c;IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=d2f5a78f-257e-4748-bd25-509258a27bd2';

/**
 * Initialize Application Insights telemetry
 * @param enabled Whether telemetry is enabled (respects user preference)
 */
export async function initTelemetry(enabled: boolean = true) {
  isEnabled = enabled;
  
  if (!enabled) {
    console.log('Telemetry disabled by user preference');
    return;
  }

  try {
    // Get machine ID for reliable user identification
    try {
      machineId = await getMachineId();
    } catch (e) {
      console.warn('Failed to get machine ID:', e);
      machineId = null;
    }

    appInsights = new ApplicationInsights({
      config: {
        connectionString: CONNECTION_STRING,
        enableAutoRouteTracking: false, // Not needed for desktop app
        disableFetchTracking: true,     // Reduce noise from API calls
        disableAjaxTracking: true,      // Reduce noise
        autoTrackPageVisitTime: false,  // Not applicable for desktop
        enableCorsCorrelation: false,   // Not needed
      }
    });
    
    appInsights.loadAppInsights();
    
    // Set the authenticated user ID to machine ID for reliable tracking
    if (machineId) {
      appInsights.setAuthenticatedUserContext(machineId);
    }
    
    appInsights.trackPageView({ name: 'AppLaunch' });
    
    console.log('Telemetry initialized', machineId ? `(machine: ${machineId.slice(0, 8)}...)` : '');
  } catch (e) {
    console.warn('Failed to initialize telemetry:', e);
    appInsights = null;
  }
}

/**
 * Track a custom event
 */
export function trackEvent(name: string, properties?: Record<string, string>) {
  if (!isEnabled || !appInsights) return;
  
  try {
    appInsights.trackEvent({ name }, properties);
  } catch (e) {
    console.warn('Failed to track event:', e);
  }
}

/**
 * Track an exception/error
 */
export function trackError(error: Error, properties?: Record<string, string>) {
  if (!isEnabled || !appInsights) return;
  
  try {
    appInsights.trackException({ exception: error }, properties);
  } catch (e) {
    console.warn('Failed to track error:', e);
  }
}

/**
 * Track a metric value
 */
export function trackMetric(name: string, value: number, properties?: Record<string, string>) {
  if (!isEnabled || !appInsights) return;
  
  try {
    appInsights.trackMetric({ name, average: value }, properties);
  } catch (e) {
    console.warn('Failed to track metric:', e);
  }
}

/**
 * Set whether telemetry is enabled
 */
export function setTelemetryEnabled(enabled: boolean) {
  isEnabled = enabled;
  if (!enabled && appInsights) {
    // Flush any pending data before disabling
    appInsights.flush();
  }
}

/**
 * Check if telemetry is enabled
 */
export function isTelemetryEnabled(): boolean {
  return isEnabled;
}
