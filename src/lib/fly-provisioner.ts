/**
 * Fly.io Provisioner for SoulPrint
 * Creates per-user Clawdbot containers on Fly.io
 */

interface FlyMachine {
  id: string;
  name: string;
  state: string;
  region: string;
  instance_id: string;
  private_ip: string;
  config: {
    env: Record<string, string>;
    image: string;
  };
}

interface FlyApp {
  id: string;
  name: string;
  status: string;
  organization: { slug: string };
}

interface ProvisionResult {
  success: boolean;
  appName?: string;
  appUrl?: string;
  machineId?: string;
  error?: string;
}

interface UserConfig {
  userId: string;
  telegramBotToken: string;
  soulName?: string;
  timezone?: string;
}

const FLY_API_URL = 'https://api.fly.io/graphql';
const FLY_MACHINES_URL = 'https://api.machines.dev/v1';

// Template app to clone from
const TEMPLATE_APP = 'soulprint-template';
const TEMPLATE_IMAGE = 'registry.fly.io/soulprint-template:deployment-01KJ5516NSWY2CYPV9JC3XWEW2';

export class FlyProvisioner {
  private apiToken: string;
  private org: string;

  constructor(apiToken: string, org: string = 'personal') {
    this.apiToken = apiToken;
    this.org = org;
  }

  private async graphql(query: string, variables?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(FLY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    const data = await response.json() as { data?: unknown; errors?: Array<{ message: string }> };
    if (data.errors) {
      throw new Error(data.errors[0].message);
    }
    return data.data;
  }

  private async machinesApi(
    method: string,
    path: string,
    body?: unknown
  ): Promise<unknown> {
    const response = await fetch(`${FLY_MACHINES_URL}${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Machines API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Create a new app for a user
   */
  async createApp(appName: string): Promise<FlyApp> {
    const query = `
      mutation CreateApp($name: String!, $organizationId: ID!) {
        createApp(input: { name: $name, organizationId: $organizationId }) {
          app {
            id
            name
            status
            organization { slug }
          }
        }
      }
    `;

    const result = await this.graphql(query, {
      name: appName,
      organizationId: this.org,
    }) as { createApp: { app: FlyApp } };

    return result.createApp.app;
  }

  /**
   * Get app status
   */
  async getAppStatus(appName: string): Promise<FlyApp | null> {
    const query = `
      query GetApp($name: String!) {
        app(name: $name) {
          id
          name
          status
          organization { slug }
        }
      }
    `;

    try {
      const result = await this.graphql(query, { name: appName }) as { app: FlyApp };
      return result.app;
    } catch {
      return null;
    }
  }

  /**
   * Create a machine in an app
   */
  async createMachine(
    appName: string,
    config: UserConfig,
    region: string = 'ord'
  ): Promise<FlyMachine> {
    const machineConfig = {
      name: `${appName}-main`,
      region,
      config: {
        image: TEMPLATE_IMAGE,
        env: {
          NODE_ENV: 'production',
          AWS_REGION: 'us-east-1',
          AWS_ACCESS_KEY_ID: '${AWS_ACCESS_KEY_ID}', // Injected from secrets
          AWS_SECRET_ACCESS_KEY: '${AWS_SECRET_ACCESS_KEY}',
          TELEGRAM_BOT_TOKEN: config.telegramBotToken,
          GITHUB_TOKEN: '${GITHUB_TOKEN}',
          GITHUB_WORKSPACE_REPO: 'Pu11en/soulprint-workspace-template',
          SOUL_NAME: config.soulName || 'Soul',
          USER_TIMEZONE: config.timezone || 'America/Chicago',
        },
        services: [
          {
            ports: [
              { port: 443, handlers: ['tls', 'http'] },
              { port: 80, handlers: ['http'] },
            ],
            protocol: 'tcp',
            internal_port: 3000,
            autostop: 'stop',
            autostart: true,
            min_machines_running: 0,
          },
        ],
        checks: {
          health: {
            type: 'http',
            port: 3000,
            path: '/health',
            interval: '15s',
            timeout: '5s',
            grace_period: '30s',
          },
        },
        guest: {
          cpu_kind: 'shared',
          cpus: 1,
          memory_mb: 1024,
        },
      },
    };

    return await this.machinesApi(
      'POST',
      `/apps/${appName}/machines`,
      machineConfig
    ) as FlyMachine;
  }

  /**
   * Set secrets for an app
   */
  async setSecrets(
    appName: string,
    secrets: Record<string, string>
  ): Promise<void> {
    const query = `
      mutation SetSecrets($appId: ID!, $secrets: [SecretInput!]!) {
        setSecrets(input: { appId: $appId, secrets: $secrets }) {
          app { id }
        }
      }
    `;

    const secretsArray = Object.entries(secrets).map(([key, value]) => ({
      key,
      value,
    }));

    await this.graphql(query, {
      appId: appName,
      secrets: secretsArray,
    });
  }

  /**
   * Provision a complete user environment
   */
  async provisionUser(config: UserConfig): Promise<ProvisionResult> {
    const appName = `soulprint-${config.userId.slice(0, 8)}`;

    try {
      // Check if app already exists
      const existing = await this.getAppStatus(appName);
      if (existing) {
        return {
          success: true,
          appName,
          appUrl: `https://${appName}.fly.dev`,
          error: 'App already exists',
        };
      }

      // Create the app
      await this.createApp(appName);

      // Set secrets (inherited from template + user-specific)
      await this.setSecrets(appName, {
        TELEGRAM_BOT_TOKEN: config.telegramBotToken,
      });

      // Create the machine
      const machine = await this.createMachine(appName, config);

      return {
        success: true,
        appName,
        appUrl: `https://${appName}.fly.dev`,
        machineId: machine.id,
      };
    } catch (error) {
      return {
        success: false,
        appName,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Delete a user's app
   */
  async deleteApp(appName: string): Promise<boolean> {
    const query = `
      mutation DeleteApp($appId: ID!) {
        deleteApp(input: { appId: $appId }) {
          organization { id }
        }
      }
    `;

    try {
      await this.graphql(query, { appId: appName });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Wake up a stopped machine
   */
  async wakeMachine(appName: string, machineId: string): Promise<boolean> {
    try {
      await this.machinesApi('POST', `/apps/${appName}/machines/${machineId}/start`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Stop a machine (for cost savings)
   */
  async stopMachine(appName: string, machineId: string): Promise<boolean> {
    try {
      await this.machinesApi('POST', `/apps/${appName}/machines/${machineId}/stop`);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton factory
export function createFlyProvisioner(env: { FLY_API_TOKEN: string }): FlyProvisioner {
  return new FlyProvisioner(env.FLY_API_TOKEN);
}
