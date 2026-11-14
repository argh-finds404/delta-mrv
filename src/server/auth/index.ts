import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { z } from "zod";
import { env } from "../../env";
import { ORG_TYPES } from "../../lib/org-type";
import { db } from "../db/client";
import * as schema from "../db/schema";
import { emailConfigured, linkMail, sendMail, type Mail } from "../email";

const ORG_TYPE = z.enum(ORG_TYPES);
const SENDS_EMAIL = emailConfigured();

/** A failed send is logged, never shown: the page says the same whether or not an account exists. */
const deliver = (mail: Mail) => sendMail(mail).catch((e: unknown) => console.error(`auth email not sent: ${e instanceof Error ? e.message : "unknown error"}`));

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Every id is a uuid column (docs/03-DATABASE.md §4); the default string ids would not fit.
  advanced: { database: { generateId: "uuid" } },
  // Verification and reset need email (src/server/email.ts). Where none is configured, as on the
  // demo build, accounts work as before and nothing asks for a link that could never arrive.
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: SENDS_EMAIL,
    revokeSessionsOnPasswordReset: true,
    ...(SENDS_EMAIL && {
      sendResetPassword: async ({ user, url }) => {
        await deliver(
          linkMail(user.email, "Reset your Delta password", `Someone asked to reset the password of the Delta account for ${user.email}.`, "Choose a new password", url, "The link works once, for one hour. If you did not ask for it, ignore this email: your password stays as it is."),
        );
      },
    }),
  },
  ...(SENDS_EMAIL && {
    emailVerification: {
      sendOnSignUp: true,
      // the sign-in form asks for a fresh link itself, one that returns through /sign-up/finish
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await deliver(
          linkMail(user.email, "Confirm your email for Delta", `Confirm that ${user.email} is yours to finish setting up your Delta account.`, "Confirm my email", url, "The link works for one hour. If you did not create an account, ignore this email."),
        );
      },
    },
  }),
  plugins: [
    organization({
      schema: {
        organization: {
          additionalFields: {
            // NOT NULL with no default: sign-up must choose what the organisation is.
            orgType: { type: "string", required: true, input: true },
            country: { type: "string", required: false, input: true },
            website: { type: "string", required: false, input: true },
          },
        },
      },
      organizationHooks: {
        // additionalFields `validator` is not applied on create (checked), so without this an
        // unknown type reaches the enum column and comes back as a 500.
        beforeCreateOrganization: async ({ organization }) => {
          if (!ORG_TYPE.safeParse(organization.orgType).success) {
            throw new APIError("BAD_REQUEST", { message: "org_type must be OWNER, VERIFIER or FUNDER" });
          }
        },
        // "Immutable without an admin action that writes an audit event" (docs/04 §2).
        // That admin path does not exist yet, so no update may change the type.
        beforeUpdateOrganization: async ({ organization }) => {
          if ("orgType" in organization) {
            throw new APIError("BAD_REQUEST", { message: "org_type cannot be changed" });
          }
        },
      },
    }),
    nextCookies(), // MUST be last
  ],
});
