
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = "https://bdbkymhfdgofevzgywpb.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkYmt5bWhmZGdvZmV2cmd5d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc0NjQzMywiZXhwIjoyMDgwMzIyNDMzfQ.NrWNmHewu7kXU6yOkNdwsMasXcqa_DJMq5ynSXy0-Dw";
const supabase = createClient(supabaseUrl, supabaseServiceKey);
async function run() {
    const { data } = await supabase.from("permissions").select("id").ilike("category", "Sales");
    data.forEach(p => console.log(p.id));
}
run();
