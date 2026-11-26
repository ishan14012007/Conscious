import type { FullContext, router } from '@forge/bridge';
import type {
  ForgeErrorCode,
  ForgeFailureStatus,
  ForgeHostContext,
  ForgeHostProduct,
  ForgeNormalizedError,
  ForgeResult,
} from '../types/forge';

export type ForgeNavigationTarget = Parameters<typeof router.navigate>[0];

type ForgeBridgeModule = typeof import('@forge/bridge');

type BridgeLoadResult =
  | { available: true; bridge: ForgeBridgeModule }
  | { available: false; isBridgeUnavailable: boolean; causeMessage: string };

let cachedBridgeLoadPromise: Promise<BridgeLoadResult> | null = null;
let cachedHostContextPromise: Promise<ForgeHostContext> | null = null;

async function loadForgeBridge(): Promise<BridgeLoadResult> {
  if (!cachedBridgeLoadPromise) {
    cachedBridgeLoadPromise = import('@forge/bridge')
      .then((bridge): BridgeLoadResult => ({ available: true, bridge }))
      .catch((error: unknown): BridgeLoadResult => ({
        available: false,
        isBridgeUnavailable: isBridgeUnavailableError(error),
        causeMessage: getErrorMessage(error),
      }));
  }
  return cachedBridgeLoadPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }
  return 'Unknown Forge bridge error.';
}

function isBridgeUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error);
  const errorName =
    error instanceof Error
      ? error.name
      : isRecord(error) && typeof error.name === 'string'
        ? error.name
        : '';

  return (
    errorName === 'BridgeAPIError' ||
    /unable to establish a connection with the custom ui bridge/i.test(message)
  );
}

function isResolverMissingError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    /resolver.*not\s*found/i.test(message) ||
    /function.*not\s*found/i.test(message) ||
    /no\s*(handler|resolver)\s*(found|registered)/i.test(message) ||
    /not\s*implemented/i.test(message)
  );
}

function extractExtensionType(context: FullContext): string | undefined {
  if (isRecord(context.extension) && typeof context.extension.type === 'string') {
    return context.extension.type;
  }
  return undefined;
}

function detectHostProduct(context: FullContext): ForgeHostProduct {
  const extensionType = extractExtensionType(context) ?? '';
  const hints = `${context.moduleKey} ${extensionType}`.toLowerCase();

  if (hints.includes('jira-service-management') || hints.includes('jsm') || hints.includes('servicedesk')) {
    return 'jsm';
  }
  if (hints.includes('confluence')) {
    return 'confluence';
  }
  if (hints.includes('jira')) {
    return 'jira';
  }
  if (hints.includes('bitbucket')) {
    return 'bitbucket';
  }
  return 'unknown';
}

function mapFullContext(context: FullContext): ForgeHostContext {
  return {
    mode: 'forge',
    product: detectHostProduct(context),
    cloudId: context.cloudId,
    workspaceId: context.workspaceId,
    accountId: context.accountId,
    siteUrl: context.siteUrl,
    moduleKey: context.moduleKey,
    environmentType: context.environmentType,
    locale: context.locale,
    timezone: context.timezone,
    extensionType: extractExtensionType(context),
  };
}

function createNormalizedFailure<T>(
  status: ForgeFailureStatus,
  code: ForgeErrorCode,
  message: string,
  resolverKey?: string,
  causeMessage?: string,
): ForgeResult<T> {
  const error: ForgeNormalizedError = {
    code,
    message,
    ...(resolverKey ? { resolverKey } : {}),
    ...(causeMessage ? { causeMessage } : {}),
  };

  return {
    ok: false,
    status,
    error,
  };
}

function unwrapInvokeResponse<T>(response: unknown): T {
  if (isRecord(response) && 'body' in response && 'metadata' in response) {
    return response.body as T;
  }
  return response as T;
}

async function resolveHostContext(): Promise<ForgeHostContext> {
  const loadResult = await loadForgeBridge();
  if (!loadResult.available) {
    return {
      mode: 'standalone',
      product: 'unknown',
    };
  }

  try {
    const context = await loadResult.bridge.view.getContext();
    return mapFullContext(context);
  } catch (error: unknown) {
    if (isBridgeUnavailableError(error)) {
      return {
        mode: 'standalone',
        product: 'unknown',
      };
    }

    return {
      mode: 'standalone',
      product: 'unknown',
    };
  }
}

export async function getHostContext(forceRefresh = false): Promise<ForgeHostContext> {
  if (!cachedHostContextPromise || forceRefresh) {
    cachedHostContextPromise = resolveHostContext();
  }
  return cachedHostContextPromise;
}

export async function isForgeHost(): Promise<boolean> {
  const host = await getHostContext();
  return host.mode === 'forge';
}

export async function invokeResolver<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
  TResult = unknown,
>(resolverKey: string, payload?: TPayload): Promise<ForgeResult<TResult>> {
  const host = await getHostContext();
  if (host.mode === 'standalone') {
    return createNormalizedFailure<TResult>(
      'standalone',
      'STANDALONE_UNAVAILABLE',
      `Forge resolver "${resolverKey}" is unavailable in standalone local mode.`,
      resolverKey,
    );
  }

  const loadResult = await loadForgeBridge();
  if (!loadResult.available) {
    return createNormalizedFailure<TResult>(
      loadResult.isBridgeUnavailable ? 'standalone' : 'error',
      loadResult.isBridgeUnavailable ? 'STANDALONE_UNAVAILABLE' : 'BRIDGE_ERROR',
      `Forge bridge is unavailable when calling "${resolverKey}".`,
      resolverKey,
      loadResult.causeMessage,
    );
  }

  try {
    const rawResponse = await loadResult.bridge.invoke<TPayload, TResult>(
      resolverKey,
      (payload ?? {}) as TPayload,
    );
    return {
      ok: true,
      status: 'ok',
      data: unwrapInvokeResponse<TResult>(rawResponse),
    };
  } catch (error: unknown) {
    const causeMessage = getErrorMessage(error);

    if (isBridgeUnavailableError(error)) {
      return createNormalizedFailure<TResult>(
        'standalone',
        'STANDALONE_UNAVAILABLE',
        `Forge bridge is unavailable when calling "${resolverKey}".`,
        resolverKey,
        causeMessage,
      );
    }

    if (isResolverMissingError(error)) {
      return createNormalizedFailure<TResult>(
        'not_implemented',
        'RESOLVER_NOT_IMPLEMENTED',
        `Forge backend resolver "${resolverKey}" is not implemented yet.`,
        resolverKey,
        causeMessage,
      );
    }

    return createNormalizedFailure<TResult>(
      'error',
      'BRIDGE_ERROR',
      `Forge resolver "${resolverKey}" failed.`,
      resolverKey,
      causeMessage,
    );
  }
}

export async function navigateTo(
  target: ForgeNavigationTarget,
): Promise<ForgeResult<void>> {
  const host = await getHostContext();
  if (host.mode === 'standalone') {
    return createNormalizedFailure<void>(
      'standalone',
      'STANDALONE_UNAVAILABLE',
      'Forge host navigation is unavailable in standalone local mode.',
    );
  }

  const loadResult = await loadForgeBridge();
  if (!loadResult.available) {
    return createNormalizedFailure<void>(
      loadResult.isBridgeUnavailable ? 'standalone' : 'error',
      loadResult.isBridgeUnavailable ? 'STANDALONE_UNAVAILABLE' : 'BRIDGE_ERROR',
      'Forge host navigation is unavailable outside the Forge host.',
      undefined,
      loadResult.causeMessage,
    );
  }

  try {
    await loadResult.bridge.router.navigate(target);
    return {
      ok: true,
      status: 'ok',
      data: undefined,
    };
  } catch (error: unknown) {
    const causeMessage = getErrorMessage(error);
    if (isBridgeUnavailableError(error)) {
      return createNormalizedFailure<void>(
        'standalone',
        'STANDALONE_UNAVAILABLE',
        'Forge host navigation is unavailable outside the Forge host.',
        undefined,
        causeMessage,
      );
    }

    return createNormalizedFailure<void>(
      'error',
      'BRIDGE_ERROR',
      'Failed to navigate via Forge router.',
      undefined,
      causeMessage,
    );
  }
}
