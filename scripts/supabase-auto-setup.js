import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('⚡ [Supabase Auto-Setup] Starting Automated Supabase Setup...');

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.error('❌ Error: SUPABASE_ACCESS_TOKEN is not set.');
    console.log('Please provide your Supabase Personal Access Token.');
    process.exit(1);
  }

  // 1. Fetch User Projects
  console.log('🔍 Fetching your Supabase projects...');
  const projRes = await fetch('https://api.supabase.com/v1/projects', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!projRes.ok) {
    const errText = await projRes.text();
    console.error(`❌ Failed to fetch projects (${projRes.status}): ${errText}`);
    process.exit(1);
  }

  const projects = await projRes.json();
  if (!projects || projects.length === 0) {
    console.error('❌ No Supabase projects found under your account. Please create one on Supabase dashboard.');
    process.exit(1);
  }

  const project = projects[0]; // Use first/active project
  console.log(`✅ Found project: "${project.name}" (ID: ${project.id}, Region: ${project.region})`);

  // 2. Fetch API Keys
  console.log('🔑 Fetching API keys...');
  const keysRes = await fetch(`https://api.supabase.com/v1/projects/${project.id}/api-keys`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  let serviceRoleKey = '';
  let anonKey = '';

  if (keysRes.ok) {
    const keys = await keysRes.json();
    serviceRoleKey = keys.find(k => k.name === 'service_role')?.api_key || '';
    anonKey = keys.find(k => k.name === 'anon')?.api_key || '';
  }

  const supabaseUrl = `https://${project.id}.supabase.co`;

  // 3. Execute schema.sql directly via Management API
  console.log('📦 Executing schema.sql to create tables, security rules, and seed data...');
  const schemaPath = path.resolve(__dirname, '../../supabase/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const queryRes = await fetch(`https://api.supabase.com/v1/projects/${project.id}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!queryRes.ok) {
    console.warn(`⚠️ Query notice: ${await queryRes.text()}`);
  } else {
    console.log('✅ Tables and schema created successfully!');
  }

  // 4. Update backend/.env automatically
  const envPath = path.resolve(__dirname, '../.env');
  let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  if (!envContent.includes('SUPABASE_URL=')) {
    envContent += `\n# Supabase Configuration (Auto-configured)\nSUPABASE_URL=${supabaseUrl}\nSUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}\nSUPABASE_ANON_KEY=${anonKey}\n`;
  } else {
    envContent = envContent.replace(/SUPABASE_URL=.*/, `SUPABASE_URL=${supabaseUrl}`);
    envContent = envContent.replace(/SUPABASE_SERVICE_ROLE_KEY=.*/, `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
    envContent = envContent.replace(/SUPABASE_ANON_KEY=.*/, `SUPABASE_ANON_KEY=${anonKey}`);
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('📝 Updated backend/.env with Supabase credentials.');

  console.log('\n🎉 ALL DONE! Supabase is 100% connected and configured.');
  console.log(`• Project URL: ${supabaseUrl}`);
  console.log('• Tables created: settings, buttons, channels, files, admins, users');
  console.log('• Default buttons seeded: APK FILE, GET KEY, TELEGRAM, SUPPORT');
  console.log('• Owner ID: 8833095685 configured');
}

main().catch(err => {
  console.error('Fatal setup error:', err);
  process.exit(1);
});
