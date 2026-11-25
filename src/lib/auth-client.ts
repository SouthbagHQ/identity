import { createAuthClient } from "better-auth/svelte";
import { usernameClient } from "better-auth/client/plugins";
import { southbagIdClient } from "$lib/southbag-id-client";

export const authClient = createAuthClient({
  plugins: [usernameClient(), southbagIdClient()],
});
