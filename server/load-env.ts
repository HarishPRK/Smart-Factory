/**
 * Loads .env BEFORE any other server module is imported.
 *
 * Why a separate file: ES-module `import` statements are hoisted and evaluated
 * before top-level statements in the importing file. If dotenv.config() lived
 * inline in index.ts, modules like ipsecSource.ts (which read process.env at
 * module-load time — IOT_IPSEC_TOPIC, AWS creds, endpoint) would be evaluated
 * FIRST and see an unpopulated env. Importing this module as the very first
 * import guarantees env is populated before those reads happen.
 */
import { config } from "dotenv";

config({ override: true });
