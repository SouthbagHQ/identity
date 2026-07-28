import { createAuthClient } from "better-auth/svelte";
import { southbagIdClient } from "$lib/southbag-id-client";

export const authClient = createAuthClient({
  plugins: [southbagIdClient()],
});
