const db = require('./db');
try {
  const r = db.prepare("SELECT * FROM system_config").all();
  console.log('ALL DATA:', JSON.stringify(r, null, 2));
  
  const r2 = db.prepare("SELECT * FROM system_config WHERE [key] IN ('contact_wechat', 'contact_email', 'contact_qr')").all();
  console.log('FILTERED:', JSON.stringify(r2, null, 2));
} catch(e) {
  console.error('ERROR:', e.message);
}
