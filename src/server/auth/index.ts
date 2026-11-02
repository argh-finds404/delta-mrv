import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { z } from "zod";
import { env } from "../../env";
import { db } from "../db/client";
import * as schema from "../db/schema";

const ORG_TYPE = z.enum(["OWNER", "VERIFIER", "FUNDER"]);

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // Every id is a uuid column (docs/03-DATABASE.md §4); the default string ids would not fit.
  advanced: { database: { generateId: "uuid" } },
  // Email verification is off for the demo build (docs/04-AUTH.md §1).
  emailAndPassword: { enabled: true },
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
