
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://bdbkymhfdgofevzgywpb.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkYmt5bWhmZGdvZmV2emd5d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc0NjQzMywiZXhwIjoyMDgwMzIyNDMzfQ.NrWNmHewu7kXU6yOkNdwsMasXcqa_DJMq5ynSXy0-Dw";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
    const { data, error } = await supabase.from("permissions").select("*");
    if (error) {
        console.error("Error fetching permissions:", error);
        return;
    }
    console.log("PERMISSION_IDS_START");
    console.log(JSON.stringify(data, null, 2));
    console.log("PERMISSION_IDS_END");
}

run();
