import { inferOrgAdditionalFields, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export { ORG_TYPES, type OrgType } from "./org-type";

// Mirrors the server's organization additionalFields (src/server/auth/index.ts).
// src/lib may not import server code, so the shape is repeated rather than inferred
// from `typeof auth`. `orgType` is required: sign-up must say what the organisation is.
export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      schema: inferOrgAdditionalFields({
        organization: {
          additionalFields: {
            orgType: { type: "string", required: true },
            country: { type: "string", required: false },
            website: { type: "string", required: false },
          },
        },
      }),
    }),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
