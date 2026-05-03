const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  
  console.log('\n  DATABASE: smart_healthcare');
  console.log('  ========================\n');
  
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    const sample = await db.collection(c.name).findOne();
    console.log(`  Collection: ${c.name} (${count} documents)`);
    if (sample) {
      const keys = Object.keys(sample).join(', ');
      console.log(`    Fields: ${keys}\n`);
    }
  }

  // Show users
  console.log('  --- USERS ---');
  const users = await db.collection('users').find({}, { projection: { password: 0 } }).toArray();
  users.forEach(u => console.log(`    ${u.name} | ${u.email} | ${u.role} | active: ${u.isActive}`));

  // Show patients
  console.log('\n  --- PATIENTS ---');
  const patients = await db.collection('patients').find().toArray();
  patients.forEach(p => console.log(`    ${p.patientId} | ${p.name} | Age: ${p.age} | Status: ${p.status}`));

  // Show health data count
  const hdCount = await db.collection('healthdatas').countDocuments();
  console.log(`\n  --- HEALTH DATA: ${hdCount} readings ---`);

  // Show alerts count
  const alertCount = await db.collection('alerts').countDocuments();
  const pendingAlerts = await db.collection('alerts').countDocuments({ acknowledged: false });
  console.log(`  --- ALERTS: ${alertCount} total, ${pendingAlerts} pending ---\n`);

  process.exit();
});
