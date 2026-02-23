const childProcess = require("child_process");
const { kOpenclawRegistryUrl } = require("../../src/server/constants");

const modulePath = require.resolve("../../src/server/openclaw-version");
const originalExec = childProcess.exec;
const originalExecSync = childProcess.execSync;

const loadVersionModule = ({ execMock, execSyncMock }) => {
  childProcess.exec = execMock;
  childProcess.execSync = execSyncMock;
  delete require.cache[modulePath];
  return require(modulePath);
};

const createService = ({ isOnboarded = false } = {}) => {
  const execMock = vi.fn();
  const execSyncMock = vi.fn();
  const { createOpenclawVersionService } = loadVersionModule({
    execMock,
    execSyncMock,
  });
  const gatewayEnv = vi.fn(() => ({ OPENCLAW_GATEWAY_TOKEN: "token" }));
  const restartGateway = vi.fn();
  const service = createOpenclawVersionService({
    gatewayEnv,
    restartGateway,
    isOnboarded: () => isOnboarded,
  });
  return { service, gatewayEnv, restartGateway, execMock, execSyncMock };
};

describe("server/openclaw-version", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    childProcess.exec = originalExec;
    childProcess.execSync = originalExecSync;
    delete require.cache[modulePath];
  });

  it("reads current version and uses cache within TTL", () => {
    const { service, gatewayEnv, execSyncMock } = createService();
    execSyncMock.mockReturnValue("openclaw 1.2.3\n");

    const first = service.readOpenclawVersion();
    const second = service.readOpenclawVersion();

    expect(first).toBe("1.2.3");
    expect(second).toBe("1.2.3");
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(execSyncMock).toHaveBeenCalledWith("openclaw --version", {
      env: gatewayEnv(),
      timeout: 5000,
      encoding: "utf8",
    });
  });

  it("returns update availability when latest version is newer", async () => {
    const { service, execSyncMock } = createService();
    execSyncMock.mockReturnValue("openclaw 1.2.3");
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ "dist-tags": { latest: "1.3.0" } }),
    });

    const status = await service.getVersionStatus(false);

    expect(global.fetch).toHaveBeenCalledWith(kOpenclawRegistryUrl, {
      headers: { Accept: "application/json" },
    });
    expect(status).toEqual({
      ok: true,
      currentVersion: "1.2.3",
      latestVersion: "1.3.0",
      hasUpdate: true,
    });
  });

  it("returns error status when latest version fetch fails", async () => {
    const { service, execSyncMock } = createService();
    execSyncMock.mockReturnValue("openclaw 1.2.3");
    global.fetch.mockRejectedValue(new Error("registry offline"));

    const status = await service.getVersionStatus(false);

    expect(status.ok).toBe(false);
    expect(status.currentVersion).toBe("1.2.3");
    expect(status.latestVersion).toBe(null);
    expect(status.hasUpdate).toBe(false);
    expect(status.error).toContain("registry offline");
  });

  it("updates openclaw and restarts gateway when onboarded", async () => {
    const { service, restartGateway, execMock, execSyncMock } = createService({
      isOnboarded: true,
    });
    execSyncMock
      .mockReturnValueOnce("openclaw 1.0.0")
      .mockReturnValueOnce("openclaw 1.1.0");
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ "dist-tags": { latest: "1.1.0" } }),
    });
    execMock.mockImplementation((cmd, opts, callback) => {
      callback(null, "installed", "");
    });

    const result = await service.updateOpenclaw();

    expect(result.status).toBe(200);
    expect(result.body).toEqual(
      expect.objectContaining({
        ok: true,
        previousVersion: "1.0.0",
        currentVersion: "1.1.0",
        latestVersion: "1.1.0",
        hasUpdate: false,
        restarted: true,
        updated: true,
      }),
    );
    expect(restartGateway).toHaveBeenCalledTimes(1);
  });

  it("returns 409 while another update is in progress", async () => {
    const { service, execMock, execSyncMock } = createService();
    execSyncMock.mockReturnValue("openclaw 1.0.0");
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ "dist-tags": { latest: "1.1.0" } }),
    });
    let installCallback = null;
    execMock.mockImplementation((cmd, opts, callback) => {
      installCallback = callback;
    });

    const firstUpdatePromise = service.updateOpenclaw();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    const secondUpdate = await service.updateOpenclaw();

    expect(secondUpdate.status).toBe(409);
    expect(secondUpdate.body).toEqual({
      ok: false,
      error: "OpenClaw update already in progress",
    });

    installCallback(null, "installed", "");
    await firstUpdatePromise;
  });
});
