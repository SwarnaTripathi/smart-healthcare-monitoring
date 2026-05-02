const express = require('express');
const { auth } = require('../middleware/auth');
const HealthData = require('../models/HealthData');
const Patient = require('../models/Patient');
const Alert = require('../models/Alert');

const router = express.Router();

// Health knowledge base
const HEALTH_KB = {
  heart_rate: {
    normal: '60–100 bpm',
    info: 'Heart rate (pulse) is the number of times your heart beats per minute. A lower resting heart rate generally implies better cardiovascular fitness.',
    low: 'A heart rate below 60 bpm is called bradycardia. It can be normal for athletes but may indicate an underlying condition if accompanied by dizziness or fatigue.',
    high: 'A heart rate above 100 bpm is called tachycardia. It can be caused by stress, caffeine, dehydration, fever, or heart conditions.',
    tips: ['Stay hydrated', 'Exercise regularly (150 min/week)', 'Limit caffeine and alcohol', 'Practice deep breathing', 'Get adequate sleep (7-9 hours)']
  },
  spo2: {
    normal: '95–100%',
    info: 'SpO2 measures the percentage of oxygen carried by hemoglobin in your blood. It is measured using a pulse oximeter.',
    low: 'SpO2 below 95% may indicate respiratory problems. Below 90% is considered a medical emergency requiring immediate attention.',
    tips: ['Practice deep breathing exercises', 'Maintain good posture for lung expansion', 'Avoid smoking', 'Stay physically active', 'Keep indoor air clean and ventilated']
  },
  temperature: {
    normal: '36.1–37.2°C (97–99°F)',
    info: 'Body temperature varies throughout the day and can be affected by activity, food intake, and environment.',
    high: 'A temperature above 38°C (100.4°F) is considered a fever. It usually indicates your body is fighting an infection.',
    low: 'A temperature below 35°C (95°F) is hypothermia and requires medical attention.',
    tips: ['Stay hydrated during fever', 'Rest adequately', 'Use light clothing if overheated', 'Monitor temperature regularly if feeling unwell']
  },
  emergency: {
    signs: ['Chest pain or pressure', 'Difficulty breathing', 'Sudden severe headache', 'Loss of consciousness', 'Uncontrolled bleeding', 'Signs of stroke (FAST: Face drooping, Arm weakness, Speech difficulty, Time to call emergency)'],
    action: 'If you experience any emergency symptoms, call emergency services (112/108) immediately. Do not wait.'
  },
  first_aid: {
    burns: 'Cool the burn under running water for at least 10 minutes. Do not apply ice, butter, or toothpaste. Cover with a sterile bandage.',
    cuts: 'Apply firm pressure with a clean cloth. Clean the wound with water. Apply antibiotic ointment and cover with a bandage.',
    choking: 'Perform the Heimlich maneuver: Stand behind the person, make a fist above their navel, and thrust inward and upward.',
    fainting: 'Lay the person flat and elevate their legs. Loosen tight clothing. If they don\'t regain consciousness within a minute, call emergency services.',
    cpr: 'For adults: Push hard and fast in the center of the chest (100-120 compressions/min, 2 inches deep). Give 2 rescue breaths after every 30 compressions.'
  },
  medications: {
    info: 'Always consult your doctor before taking any medication. Never self-medicate based on chatbot advice.',
    reminder: 'Set regular alarms for medication times. Use a pill organizer for weekly doses. Keep a medication log.'
  }
};

// Intent detection
function detectIntent(message) {
  const msg = message.toLowerCase().trim();
  
  // Greetings
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)/i.test(msg)) return 'greeting';
  
  // Health data queries
  if (/my\s*(latest|current|recent|last)?\s*(vitals?|health|readings?|data|stats?|status)/i.test(msg)) return 'my_vitals';
  if (/my\s*(heart\s*rate|pulse|hr|bpm)/i.test(msg)) return 'my_hr';
  if (/my\s*(spo2|oxygen|o2|saturation)/i.test(msg)) return 'my_spo2';
  if (/my\s*(temp|temperature|fever)/i.test(msg)) return 'my_temp';
  if (/my\s*(alerts?|warnings?|notifications?)/i.test(msg)) return 'my_alerts';
  
  // Health knowledge
  if (/normal\s*(heart\s*rate|pulse|hr|bpm)|heart\s*rate\s*(range|normal)/i.test(msg)) return 'info_hr';
  if (/normal\s*(spo2|oxygen|o2)|spo2\s*(range|normal)|oxygen\s*(level|range|normal)/i.test(msg)) return 'info_spo2';
  if (/normal\s*(temp|temperature)|temperature\s*(range|normal)|fever\s*(temp|range)/i.test(msg)) return 'info_temp';
  if (/(what\s*is|explain|tell.*about)\s*(heart\s*rate|pulse|bpm)/i.test(msg)) return 'explain_hr';
  if (/(what\s*is|explain|tell.*about)\s*(spo2|oxygen\s*saturation|blood\s*oxygen)/i.test(msg)) return 'explain_spo2';
  if (/(what\s*is|explain|tell.*about)\s*(body\s*)?temp/i.test(msg)) return 'explain_temp';
  
  // Tips & advice
  if (/(tips?|advice|improve|how\s*to)\s*(for|to)?\s*(heart|cardio|cardiovascular)/i.test(msg)) return 'tips_hr';
  if (/(tips?|advice|improve|how\s*to)\s*(for|to)?\s*(spo2|oxygen|breathing|lungs?)/i.test(msg)) return 'tips_spo2';
  if (/(tips?|advice|improve|how\s*to)\s*(for|to)?\s*(temp|fever|cool\s*down)/i.test(msg)) return 'tips_temp';
  if (/(health|wellness|healthy|lifestyle)\s*(tips?|advice)/i.test(msg)) return 'tips_general';
  
  // Emergency
  if (/(emergency|urgent|help\s*me|chest\s*pain|can'?t\s*breathe|breathing\s*problem|stroke)/i.test(msg)) return 'emergency';
  if (/(first\s*aid|what\s*to\s*do\s*(if|when|for))/i.test(msg)) return 'first_aid_general';
  if (/(burn|burned|scalded)/i.test(msg)) return 'first_aid_burns';
  if (/(cut|bleeding|wound)/i.test(msg)) return 'first_aid_cuts';
  if (/(chok|choking)/i.test(msg)) return 'first_aid_choking';
  if (/(faint|unconscious|passed?\s*out)/i.test(msg)) return 'first_aid_fainting';
  if (/cpr|cardio\s*pulmonary/i.test(msg)) return 'first_aid_cpr';
  
  // Medication
  if (/(medic|drug|pill|tablet|prescription|dose|dosage)/i.test(msg)) return 'medication';
  
  // App navigation
  if (/(how\s*to|where|navigate|find|use|upload)\s*(report|document|test|lab)/i.test(msg)) return 'nav_reports';
  if (/(how\s*to|where|navigate|find|see)\s*(history|past|previous|old)\s*(data|reading|vital)/i.test(msg)) return 'nav_history';
  if (/(how\s*to|where|navigate|find|see)\s*(alert|notification|warning)/i.test(msg)) return 'nav_alerts';
  if (/(how\s*to|where|navigate|find|update|edit)\s*(profile|info|details|personal)/i.test(msg)) return 'nav_profile';
  
  // Thanks / bye
  if (/^(thanks?|thank\s*you|thx|ty)/i.test(msg)) return 'thanks';
  if (/^(bye|goodbye|see\s*you|quit|exit)/i.test(msg)) return 'goodbye';
  
  // BMI
  if (/bmi|body\s*mass/i.test(msg)) return 'bmi';
  
  // General health
  if (/(blood\s*pressure|bp|hypertension|hypotension)/i.test(msg)) return 'bp';
  if (/(diabetes|sugar|glucose|insulin)/i.test(msg)) return 'diabetes';
  if (/(stress|anxiety|mental\s*health|depression)/i.test(msg)) return 'mental_health';
  if (/(sleep|insomnia|rest)/i.test(msg)) return 'sleep';
  if (/(diet|nutrition|food|eat)/i.test(msg)) return 'diet';
  if (/(exercise|workout|fitness|physical\s*activity)/i.test(msg)) return 'exercise';
  
  return 'unknown';
}

// Generate response based on intent
async function generateResponse(intent, userId, userRole) {
  switch (intent) {
    case 'greeting':
      return { text: "Hello! 👋 I'm HealthGuard AI, your healthcare assistant. I can help you with:\n\n• 📊 Check your vitals & health data\n• 💡 Health tips & medical info\n• 🆘 Emergency & first aid guidance\n• 🧭 Navigate the app\n\nWhat would you like to know?", type: 'info' };

    case 'my_vitals':
      return await getPatientVitals(userId, userRole);
    case 'my_hr':
      return await getSpecificVital(userId, userRole, 'heartRate');
    case 'my_spo2':
      return await getSpecificVital(userId, userRole, 'spO2');
    case 'my_temp':
      return await getSpecificVital(userId, userRole, 'temperature');
    case 'my_alerts':
      return await getPatientAlerts(userId, userRole);

    case 'info_hr':
      return { text: `**Normal Heart Rate Range:** ${HEALTH_KB.heart_rate.normal}\n\n${HEALTH_KB.heart_rate.info}`, type: 'info' };
    case 'info_spo2':
      return { text: `**Normal SpO2 Range:** ${HEALTH_KB.spo2.normal}\n\n${HEALTH_KB.spo2.info}`, type: 'info' };
    case 'info_temp':
      return { text: `**Normal Temperature:** ${HEALTH_KB.temperature.normal}\n\n${HEALTH_KB.temperature.info}`, type: 'info' };

    case 'explain_hr':
      return { text: `**Heart Rate (Pulse)**\n\n${HEALTH_KB.heart_rate.info}\n\n📏 Normal: ${HEALTH_KB.heart_rate.normal}\n⬇️ Low: ${HEALTH_KB.heart_rate.low}\n⬆️ High: ${HEALTH_KB.heart_rate.high}`, type: 'info' };
    case 'explain_spo2':
      return { text: `**Blood Oxygen Saturation (SpO2)**\n\n${HEALTH_KB.spo2.info}\n\n📏 Normal: ${HEALTH_KB.spo2.normal}\n⬇️ Low: ${HEALTH_KB.spo2.low}`, type: 'info' };
    case 'explain_temp':
      return { text: `**Body Temperature**\n\n${HEALTH_KB.temperature.info}\n\n📏 Normal: ${HEALTH_KB.temperature.normal}\n⬆️ High: ${HEALTH_KB.temperature.high}\n⬇️ Low: ${HEALTH_KB.temperature.low}`, type: 'info' };

    case 'tips_hr':
      return { text: `**Heart Health Tips ❤️**\n\n${HEALTH_KB.heart_rate.tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`, type: 'tip' };
    case 'tips_spo2':
      return { text: `**Breathing & Oxygen Tips 🫁**\n\n${HEALTH_KB.spo2.tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`, type: 'tip' };
    case 'tips_temp':
      return { text: `**Temperature Management Tips 🌡️**\n\n${HEALTH_KB.temperature.tips.map((t, i) => `${i + 1}. ${t}`).join('\n')}`, type: 'tip' };
    case 'tips_general':
      return { text: "**General Health Tips 🌟**\n\n1. 💧 Drink 8 glasses of water daily\n2. 🏃 Exercise 150 minutes per week\n3. 😴 Sleep 7-9 hours every night\n4. 🥗 Eat balanced meals with fruits & vegetables\n5. 🧘 Practice stress management (meditation, deep breathing)\n6. 🚭 Avoid smoking and limit alcohol\n7. 📋 Get regular health check-ups\n8. 💊 Take medications as prescribed", type: 'tip' };

    case 'emergency':
      return { text: `🚨 **EMERGENCY GUIDANCE**\n\n${HEALTH_KB.emergency.action}\n\n**Emergency warning signs:**\n${HEALTH_KB.emergency.signs.map(s => `• ${s}`).join('\n')}\n\n📞 **Emergency Numbers:**\n• Ambulance: 108\n• Emergency: 112\n• Poison Control: 1800-11-6117`, type: 'emergency' };
    
    case 'first_aid_general':
      return { text: "**First Aid Topics 🩹**\n\nI can help with first aid for:\n• Burns — say \"first aid for burns\"\n• Cuts & bleeding — say \"first aid for cuts\"\n• Choking — say \"choking first aid\"\n• Fainting — say \"what to do if someone faints\"\n• CPR — say \"how to do CPR\"\n\nWhat situation do you need help with?", type: 'info' };
    case 'first_aid_burns': return { text: `**First Aid: Burns 🔥**\n\n${HEALTH_KB.first_aid.burns}`, type: 'warning' };
    case 'first_aid_cuts': return { text: `**First Aid: Cuts & Bleeding 🩸**\n\n${HEALTH_KB.first_aid.cuts}`, type: 'warning' };
    case 'first_aid_choking': return { text: `**First Aid: Choking**\n\n${HEALTH_KB.first_aid.choking}`, type: 'warning' };
    case 'first_aid_fainting': return { text: `**First Aid: Fainting**\n\n${HEALTH_KB.first_aid.fainting}`, type: 'warning' };
    case 'first_aid_cpr': return { text: `**CPR Instructions 💓**\n\n${HEALTH_KB.first_aid.cpr}`, type: 'warning' };

    case 'medication':
      return { text: `**Medication Guidance 💊**\n\n${HEALTH_KB.medications.info}\n\n**Tips:**\n${HEALTH_KB.medications.reminder}`, type: 'warning' };

    case 'nav_reports':
      return { text: "**📄 Uploading Reports**\n\n1. Click **\"My Reports\"** in the sidebar\n2. Click the **\"Upload Report\"** button (top right)\n3. Fill in the title and select report type\n4. Choose your file (PDF, JPG, PNG, DOC — max 10MB)\n5. Click **Upload**\n\nYou can view, download, or delete your reports anytime!", type: 'info' };
    case 'nav_history':
      return { text: "**📊 Viewing Health History**\n\n1. Click **\"Health History\"** in the sidebar\n2. Select a patient from the dropdown\n3. View charts showing Heart Rate, SpO2, and Temperature over time\n4. Scroll down for the raw data table\n\nThe data updates automatically when new readings come in.", type: 'info' };
    case 'nav_alerts':
      return { text: "**🔔 Checking Alerts**\n\n1. Click **\"Alerts\"** (or \"My Alerts\") in the sidebar\n2. Use the filter buttons: All, Unacknowledged, Critical, Warning\n3. Doctors/Admins can acknowledge alerts\n\nAlerts are generated automatically when your vitals go outside normal ranges.", type: 'info' };
    case 'nav_profile':
      return { text: "**👤 Updating Your Profile**\n\n1. Click **\"My Profile\"** in the sidebar\n2. Click **\"Edit Profile\"** button (top right)\n3. Update your phone, address, medical history, or emergency contact\n4. Click **\"Save Changes\"**", type: 'info' };

    case 'thanks':
      return { text: "You're welcome! 😊 Let me know if you need anything else. Stay healthy! 💚", type: 'info' };
    case 'goodbye':
      return { text: "Goodbye! 👋 Take care and stay healthy. I'm here whenever you need me! 💚", type: 'info' };

    case 'bmi':
      return { text: "**Body Mass Index (BMI) 📏**\n\nBMI = weight(kg) / height(m)²\n\n• Underweight: < 18.5\n• Normal: 18.5 – 24.9\n• Overweight: 25 – 29.9\n• Obese: ≥ 30\n\n⚠️ BMI is a screening tool, not a diagnostic one. Consult your doctor for a complete assessment.", type: 'info' };

    case 'bp':
      return { text: "**Blood Pressure 🩸**\n\n• Normal: < 120/80 mmHg\n• Elevated: 120-129 / < 80\n• High (Stage 1): 130-139 / 80-89\n• High (Stage 2): ≥ 140 / ≥ 90\n• Crisis: > 180 / > 120 (seek emergency care)\n\n**Tips:** Reduce sodium, exercise regularly, maintain a healthy weight, and limit alcohol.", type: 'info' };

    case 'diabetes':
      return { text: "**Diabetes Information 🍬**\n\n**Fasting Blood Sugar:**\n• Normal: < 100 mg/dL\n• Pre-diabetic: 100–125 mg/dL\n• Diabetic: ≥ 126 mg/dL\n\n**Management Tips:**\n1. Monitor blood sugar regularly\n2. Follow a balanced, low-sugar diet\n3. Exercise 30 min daily\n4. Take medications as prescribed\n5. Regular eye and foot checkups", type: 'info' };

    case 'mental_health':
      return { text: "**Mental Health Support 🧠**\n\nIt's important to take care of your mental health:\n\n1. 🧘 Practice mindfulness and meditation\n2. 💬 Talk to someone you trust\n3. 📝 Keep a journal\n4. 🏃 Exercise regularly (releases endorphins)\n5. 😴 Maintain a sleep schedule\n6. 📱 Limit screen time\n\n**Helplines:**\n• NIMHANS: 080-46110007\n• Vandrevala Foundation: 1860-2662-345\n• iCall: 9152987821\n\nYou are not alone. Seeking help is a sign of strength. 💚", type: 'info' };

    case 'sleep':
      return { text: "**Sleep Health 😴**\n\nAdults need 7-9 hours of sleep.\n\n**Tips for better sleep:**\n1. 🕐 Stick to a schedule\n2. 📱 No screens 1 hour before bed\n3. 🌡️ Keep room cool (18-22°C)\n4. ☕ Avoid caffeine after 2 PM\n5. 🧘 Try relaxation techniques\n6. 🏃 Exercise (but not close to bedtime)\n7. 🌙 Keep your room dark and quiet", type: 'tip' };

    case 'diet':
      return { text: "**Nutrition Tips 🥗**\n\n1. 🍎 Eat 5 servings of fruits & vegetables daily\n2. 🌾 Choose whole grains over refined\n3. 🐟 Include lean proteins (fish, chicken, legumes)\n4. 💧 Drink 2-3 liters of water daily\n5. 🧂 Limit sodium to < 2300 mg/day\n6. 🍬 Reduce added sugars\n7. 🥛 Get adequate calcium and vitamin D", type: 'tip' };

    case 'exercise':
      return { text: "**Exercise Guidelines 🏃**\n\n**WHO Recommendations:**\n• 150 min moderate OR 75 min vigorous aerobic activity/week\n• Strength training 2+ days/week\n• Reduce sedentary time\n\n**Easy ways to start:**\n1. 🚶 Walk 30 min daily\n2. 🧘 Try yoga or stretching\n3. 🚴 Cycling or swimming\n4. 🏋️ Bodyweight exercises at home\n5. 🎯 Set realistic goals and track progress", type: 'tip' };

    default:
      return { text: "I'm not sure I understand that. Here's what I can help with:\n\n• **\"My vitals\"** — Check your latest health data\n• **\"Normal heart rate\"** — Learn about vital ranges\n• **\"Health tips\"** — Get wellness advice\n• **\"Emergency\"** — Emergency guidance\n• **\"First aid\"** — First aid instructions\n• **\"How to upload report\"** — App navigation help\n• **\"Blood pressure\"** / **\"Diabetes\"** / **\"Sleep\"** — Health topics\n\nTry asking me something!", type: 'info' };
  }
}

// Fetch patient vitals
async function getPatientVitals(userId, role) {
  try {
    const patient = await Patient.findOne({ assignedDoctor: userId }).sort({ createdAt: -1 }) || await Patient.findOne();
    if (!patient) return { text: "I couldn't find any patient records linked to your account yet.", type: 'info' };

    const latest = await HealthData.findOne({ patientId: patient.patientId }).sort({ timestamp: -1 });
    if (!latest) return { text: `Patient **${patient.name}** (${patient.patientId}) has no health readings yet. Start the IoT simulator to begin monitoring.`, type: 'info' };

    const hrStatus = latest.heartRate < 60 || latest.heartRate > 100 ? '⚠️' : '✅';
    const spo2Status = latest.spO2 < 95 ? '⚠️' : '✅';
    const tempStatus = latest.temperature < 36.1 || latest.temperature > 37.5 ? '⚠️' : '✅';

    return {
      text: `**Latest Vitals for ${patient.name}** 📊\n_${new Date(latest.timestamp).toLocaleString()}_\n\n${hrStatus} Heart Rate: **${latest.heartRate} bpm** (Normal: 60-100)\n${spo2Status} SpO2: **${latest.spO2}%** (Normal: 95-100)\n${tempStatus} Temperature: **${latest.temperature}°C** (Normal: 36.1-37.2)\n\n📋 Overall Status: **${latest.status.toUpperCase()}**`,
      type: latest.status === 'critical' ? 'emergency' : latest.status === 'warning' ? 'warning' : 'info'
    };
  } catch (e) { return { text: 'Error fetching vitals. Please try again.', type: 'error' }; }
}

async function getSpecificVital(userId, role, vital) {
  try {
    const patient = await Patient.findOne({ assignedDoctor: userId }).sort({ createdAt: -1 }) || await Patient.findOne();
    if (!patient) return { text: "No patient records found.", type: 'info' };
    const latest = await HealthData.findOne({ patientId: patient.patientId }).sort({ timestamp: -1 });
    if (!latest) return { text: "No health data available yet.", type: 'info' };

    const labels = { heartRate: 'Heart Rate', spO2: 'SpO2', temperature: 'Temperature' };
    const units = { heartRate: 'bpm', spO2: '%', temperature: '°C' };
    const value = latest[vital];
    return { text: `**${labels[vital]}:** ${value} ${units[vital]}\n_Recorded: ${new Date(latest.timestamp).toLocaleString()}_\n\nPatient: ${patient.name} (${patient.patientId})`, type: 'info' };
  } catch (e) { return { text: 'Error fetching data.', type: 'error' }; }
}

async function getPatientAlerts(userId, role) {
  try {
    const alerts = await Alert.find({ acknowledged: false }).sort({ createdAt: -1 }).limit(5);
    if (alerts.length === 0) return { text: "✅ No pending alerts! All systems are running normally.", type: 'info' };
    const list = alerts.map(a => `• **${a.type.toUpperCase()}:** ${a.message}`).join('\n');
    return { text: `**Pending Alerts (${alerts.length})** 🔔\n\n${list}`, type: 'warning' };
  } catch (e) { return { text: 'Error fetching alerts.', type: 'error' }; }
}

// POST /api/chatbot
router.post('/', auth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

    const intent = detectIntent(message);
    const response = await generateResponse(intent, req.user._id, req.user.role);

    res.json({
      reply: response.text,
      type: response.type,
      intent,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Chatbot error', reply: 'Sorry, I encountered an error. Please try again.' });
  }
});

module.exports = router;
