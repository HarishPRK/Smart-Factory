import { describe, expect, it } from 'vitest';
import {
  redactSensitiveText,
  sanitizeInsightPayload,
  sanitizeIpsecSnapshot,
} from './ai-governance';

describe('AI governance sanitization', () => {
  it('redacts network and credential identifiers from free text', () => {
    const result = redactSensitiveText(
      'device AA:11:22:33:44:55 at 10.20.30.40 used AKIA1234567890123456',
    );

    expect(result.value).not.toContain('AA:11:22:33:44:55');
    expect(result.value).not.toContain('10.20.30.40');
    expect(result.value).not.toContain('AKIA1234567890123456');
    expect(result.removedFields).toEqual(
      expect.arrayContaining(['mac', 'ipv4', 'aws_access_key']),
    );
  });

  it('pseudonymizes device inventory and drops stable identifiers', () => {
    const result = sanitizeInsightPayload('ot-devices', {
      domain: 'OT',
      total: 1,
      counts: { ok: 1 },
      devices: [{
        id: 'sensor-serial-42',
        name: 'Boiler Sensor',
        ip: '10.0.0.42',
        mac: 'AA:BB:CC:DD:EE:FF',
        kind: 'temperature_sensor',
        status: 'ok',
        conn: 'wifi',
      }],
    });

    expect(JSON.stringify(result.value)).not.toMatch(/sensor-serial|Boiler|10\.0\.0\.42|AA:BB/);
    expect(result.value).toMatchObject({
      devices: [{
        pseudonym: 'device-1',
        kind: 'temperature_sensor',
        status: 'ok',
        connection: 'wifi',
      }],
    });
  });

  it('removes gateway names, addresses, hostnames, SSIDs and MACs', () => {
    const result = sanitizeIpsecSnapshot({
      receivedAt: 123,
      gateways: {
        'real-gateway-name': {
          metrics: {
            gateway: {
              name: 'real-gateway-name',
              mac: 'AA:BB:CC:DD:EE:FF',
              prim_wan_ip: '192.0.2.1',
            },
            wifi: {
              clients: [{
                hostname: 'operator-laptop',
                ip: '10.0.0.5',
                ssid: 'Factory-Private',
                rssi: -51,
              }],
            },
          },
        },
      },
    });
    const serialized = JSON.stringify(result.value);

    expect(serialized).not.toMatch(/real-gateway|AA:BB|192\.0\.2\.1|operator-laptop|10\.0\.0\.5|Factory-Private/);
    expect(serialized).toContain('gateway-1');
    expect(serialized).toContain('"rssi":-51');
  });
});
