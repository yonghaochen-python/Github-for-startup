/** Public contact for privacy requests, deletion requests and questions. */
export const CONTACT_EMAIL = "virm.virtualmirror@gmail.com";
export const POLICY_UPDATED = "November 2026";

/** Billing is switched on here (the trial and Plus can be bought). Server only. */
export const billingIsOn = () => process.env.BILLING_ENABLED === "1";
