import Stripe from "stripe";

const isProduction = process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";

// STRIPE_TEST_MODE=true enables test keys in development
// In all other cases (including when test secrets exist), live keys are used
const useTestMode = !isProduction && process.env.STRIPE_TEST_MODE === "true";

console.log(`[stripe] mode: ${useTestMode ? "TEST" : "LIVE"} (isProduction=${isProduction}, STRIPE_TEST_MODE=${process.env.STRIPE_TEST_MODE})`);

async function getCredentials() {
  // Test mode: only when explicitly enabled via STRIPE_TEST_MODE=true env var
  if (useTestMode && process.env.STRIPE_TEST_SECRET_KEY && process.env.STRIPE_TEST_PUBLISHABLE_KEY) {
    return {
      secretKey: process.env.STRIPE_TEST_SECRET_KEY,
      publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY,
    };
  }

  // Live keys (default for all environments)
  if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY) {
    return {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (hostname && xReplitToken) {
    const connectorName = "stripe";
    const targetEnvironment = isProduction ? "production" : "development";

    const url = new URL(`https://${hostname}/api/v2/connection`);
    url.searchParams.set("include_secrets", "true");
    url.searchParams.set("connector_names", connectorName);
    url.searchParams.set("environment", targetEnvironment);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    });

    const data = await response.json();
    const connectionSettings = data.items?.[0];

    if (
      connectionSettings &&
      connectionSettings.settings.publishable &&
      connectionSettings.settings.secret
    ) {
      return {
        publishableKey: connectionSettings.settings.publishable,
        secretKey: connectionSettings.settings.secret,
      };
    }
  }

  throw new Error(
    "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY environment secrets."
  );
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-11-17.clover",
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export { isProduction };
