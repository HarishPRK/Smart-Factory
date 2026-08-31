import type { AppCategory, AppPolicy, DeviceInventorySource, PathThreshold } from '../types';

/** Source mapping shared by Dynamic Failover and Application Traffic Routing. */
export const BRANCH_TO_IPSEC_SOURCE: Record<string, 'rdk' | 'prpl'> = {
  'b-pln-01': 'rdk',
  'b-mck-03': 'prpl',
};

/** Device-list source used by branch-scoped DPS and AAR visualizations.
 * McKinney's IT/OT fleet is published in the prplhome IPsec metrics feed. */
export const BRANCH_TO_DEVICE_SOURCE: Record<string, DeviceInventorySource> = {
  'b-pln-01': 'rdk',
  'b-mck-03': 'prplhome',
};

export const pathThresholds: PathThreshold[] = [
  { metric: 'latency', fiber: { warn: 80,  fail: 150 }, fiveg: { warn: 120, fail: 200 }, unit: 'ms' },
  { metric: 'jitter',  fiber: { warn: 30,  fail: 60  }, fiveg: { warn: 40,  fail: 80  }, unit: 'ms' },
  { metric: 'loss',    fiber: { warn: 1,   fail: 3   }, fiveg: { warn: 1.5, fail: 5   }, unit: '%'  },
  { metric: 'mos',     fiber: { warn: 3.6, fail: 3.0 }, fiveg: { warn: 3.4, fail: 2.8 }, unit: ''   },
];

export const appCategories: AppCategory[] = [
  { id: 'voice',    name: 'Voice',          slaClass: 'realtime',    trafficSharePct: 12, color: '#06b6d4', description: 'VoIP, conferencing audio' },
  { id: 'video',    name: 'Video',          slaClass: 'realtime',    trafficSharePct: 31, color: '#10b981', description: 'Teams, Meet, Zoom video' },
  { id: 'business', name: 'Business apps',  slaClass: 'business',    trafficSharePct: 24, color: '#84cc16', description: 'SaaS, ERP, CRM, mail' },
  { id: 'web',      name: 'Web browsing',   slaClass: 'best-effort', trafficSharePct: 18, color: '#a855f7', description: 'General HTTP/HTTPS' },
  { id: 'bulk',     name: 'Bulk transfer',  slaClass: 'best-effort', trafficSharePct: 8,  color: '#f59e0b', description: 'Backups, OS updates' },
  { id: 'iot',      name: 'OT / IoT',       slaClass: 'business',    trafficSharePct: 7,  color: '#ef4444', description: 'Sensors, locks, telemetry' },
];

export const appPolicies: AppPolicy[] = [
  { id: 'ap1', app: 'Microsoft Teams',   category: 'video',    preferredPath: 'Fiber', backupPath: '5G',    match: 'DSCP EF · *.teams.microsoft.com', hitsPerMin: 142, throughputMbps: 88, slaClass: 'realtime',    enabled: true },
  { id: 'ap2', app: 'Google Meet',       category: 'video',    preferredPath: 'Fiber', backupPath: '5G',    match: '*.meet.google.com',               hitsPerMin: 96,  throughputMbps: 54, slaClass: 'realtime',    enabled: true },
  { id: 'ap3', app: 'VoIP Gateway',      category: 'voice',    preferredPath: 'Fiber', backupPath: '5G',    match: 'SIP / RTP · DSCP EF',             hitsPerMin: 220, throughputMbps: 6,  slaClass: 'realtime',    enabled: true },
  { id: 'ap4', app: 'Microsoft 365',     category: 'business', preferredPath: 'Auto',  backupPath: 'None',  match: '*.office.com, *.sharepoint.com',  hitsPerMin: 312, throughputMbps: 41, slaClass: 'business',    enabled: true },
  { id: 'ap5', app: 'Google Workspace',  category: 'business', preferredPath: 'Auto',  backupPath: 'None',  match: '*.google.com / mail.google.com',  hitsPerMin: 187, throughputMbps: 22, slaClass: 'business',    enabled: true },
  { id: 'ap6', app: 'Salesforce',        category: 'business', preferredPath: 'Fiber', backupPath: '5G',    match: '*.force.com, *.salesforce.com',   hitsPerMin: 64,  throughputMbps: 9,  slaClass: 'business',    enabled: true },
  { id: 'ap7', app: 'Web browsing',      category: 'web',      preferredPath: 'Auto',  backupPath: 'None',  match: 'TCP/443, TCP/80 (default)',       hitsPerMin: 540, throughputMbps: 76, slaClass: 'best-effort', enabled: true },
  { id: 'ap8', app: 'OS Updates',        category: 'bulk',     preferredPath: '5G',    backupPath: 'Fiber', match: 'WSUS, *.windowsupdate.com',       hitsPerMin: 8,   throughputMbps: 12, slaClass: 'best-effort', enabled: true },
  { id: 'ap9', app: 'Cloud Backup',      category: 'bulk',     preferredPath: '5G',    backupPath: 'Fiber', match: '*.s3.amazonaws.com',             hitsPerMin: 4,   throughputMbps: 18, slaClass: 'best-effort', enabled: false },
  { id: 'ap10', app: 'OT Telemetry',     category: 'iot',      preferredPath: 'Fiber', backupPath: '5G',    match: 'MQTT · TCP/8883',                 hitsPerMin: 360, throughputMbps: 2,  slaClass: 'business',    enabled: true },
];
