import Stripe from "stripe";

const isProduction = process.env.REPLIT_DEPLOYMENT === "1";

// Startup log — shows key mode without exposing secrets
const _stripeMode = !isProduction && !!process.env.STRIPE_TEST_SECRET_KEY ? "TEST" : "LIVE";
console.log(`[stripe] mode: ${_stripeMode} (isProduction=${isProduction})`);

async function getCredentials() {
  // In development, prefer test keys if they exist — keeps live keys safe
  if (!isProduction && process.env.STRIPE_TEST_SECRET_KEY && process.env.STRIPE_TEST_PUBLISHABLE_KEY) {
    return {
      secretKey: process.env.STRIPE_TEST_SECRET_KEY,
      publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY,
    };
  }

  // In production (or dev without test keys), use live keys
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
    "Stripe is not configured. Set STRIPE_TEST_SECRET_KEY and STRIPE_TEST_PUBLISHABLE_KEY for development, or STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY for production."
  );
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil" as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export { isProduction };
