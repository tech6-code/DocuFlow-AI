
import { supabaseAdmin } from "./src/lib/supabase";
import * as dotenv from "dotenv";
dotenv.config();

async function check() {
    console.log("--- PERMISSIONS ---");
    const { data: perms } = await supabaseAdmin.from("permissions").select("*");
    console.log(JSON.stringify(perms, null, 2));

    console.log("\n--- ROLES & THEIR PERMISSIONS ---");
    const { data: roles } = await supabaseAdmin
        .from("roles")
        .select("*, role_permissions(permission_id)");
    console.log(JSON.stringify(roles, null, 2));
}

check().catch(console.error);
