
const fs = require('fs');
const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = "https://bdbkymhfdgofevzgywpb.supabase.co";
const supabaseServiceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkYmt5bWhmZGdvZmV2emd5d3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc0NjQzMywiZXhwIjoyMDgwMzIyNDMzfQ.NrWNmHewu7kXU6yOkNdwsMasXcqa_DJMq5ynSXy0-Dw";
const supabase = createClient(supabaseUrl, supabaseServiceKey);
async function run() {
    console.log('Fetching permissions...');
    const { data, error } = await supabase.from("permissions").select("*");
    if (error) {
        console.error('Supabase Error:', error);
        return;
    }
    if (!data) {
        console.error('No data returned');
        return;
    }
    fs.writeFileSync('full_perms.json', JSON.stringify(data, null, 2));
    console.log('Saved ' + data.length + ' permissions to full_perms.json');
}
run();
