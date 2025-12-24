
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bdbkymhfdgofevzgywpb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkYmt5bWhmZGdvZmV2emd5d3BiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NDY0MzMsImV4cCI6MjA4MDMyMjQzM30.zeLN5wDdHapwwN062DdfelyuuAv5NaPfbo96HVlPAmM';

export const supabase = createClient(supabaseUrl, supabaseKey);
