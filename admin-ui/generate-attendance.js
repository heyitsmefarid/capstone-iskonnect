import fs from 'fs';

const filePath = 'C:\\Users\\galla\\Desktop\\tryCityEduc\\admin-ui\\src\\context\\AppContext.jsx';
const content = fs.readFileSync(filePath, 'utf8');

// Activities
const activities = [
  { activity: 'Orientation Seminar', date: '2024-08-15' },
  { activity: 'Community Service Day', date: '2024-09-20' },
  { activity: 'Leadership Training', date: '2024-10-15' },
  { activity: 'Thanksgiving Celebration', date: '2024-11-25' },
  { activity: 'Year-End Assembly', date: '2024-12-10' },
  { activity: 'General Assembly - 1st Sem', date: '2025-01-20' },
  { activity: 'Scholarship Summit', date: '2025-02-10' },
  { activity: 'Skills Workshop - Excel', date: '2025-03-05' },
  { activity: 'Career Guidance Seminar', date: '2025-03-15' },
  { activity: 'Environmental Awareness Day', date: '2025-04-22' },
  { activity: 'Sports Fest', date: '2025-05-10' },
  { activity: 'Values Formation Seminar', date: '2025-06-05' },
  { activity: 'Mid-Year Evaluation', date: '2025-07-15' },
  { activity: 'Orientation Seminar', date: '2025-08-15' },
  { activity: 'Community Service Day', date: '2025-09-20' },
  { activity: 'Leadership Training', date: '2025-10-15' },
  { activity: 'Alumni Homecoming', date: '2025-11-15' },
  { activity: 'Thanksgiving Celebration', date: '2025-11-25' },
  { activity: 'Christmas Party', date: '2025-12-15' },
  { activity: 'Year-End Assembly', date: '2025-12-20' }
];

// Random time generator
function randomTime() {
  const hour = String(Math.floor(Math.random() * 10) + 8).padStart(2, '0');
  const minute = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  const second = String(Math.floor(Math.random() * 60)).padStart(2, '0');
  return `${hour}:${minute}:${second}`;
}

// Generate attendance based on pattern
function generateAttendance(pattern, graduationStatus) {
  let absences = 0;
  
  // Determine number of absences based on pattern
  if (pattern === 'excellent') absences = Math.floor(Math.random() * 3); // 0-2
  else if (pattern === 'good') absences = Math.floor(Math.random() * 2) + 3; // 3-4
  else if (pattern === 'atrisk') absences = Math.floor(Math.random() * 3) + 5; // 5-7
  
  // Select random activities to mark absent
  const absentIndices = new Set();
  while (absentIndices.size < absences) {
    absentIndices.add(Math.floor(Math.random() * activities.length));
  }
  
  // For graduated students, exclude 2025 events after graduation
  const attendanceRecords = activities.map((activity, index) => {
    const isAbsent = absentIndices.has(index);
    const timeLogged = `${activity.date} ${randomTime()}`;
    
    // Skip future events for graduated scholars
    if (graduationStatus === 'graduated' && activity.date.startsWith('2025') && 
        parseInt(activity.date.split('-')[1]) > 6) {
      return null;
    }
    
    return {
      activity: activity.activity,
      date: activity.date,
      present: !isAbsent,
      timeLogged: timeLogged,
      loggedVia: 'Manual'
    };
  }).filter(record => record !== null);
  
  return attendanceRecords;
}

// Parse scholars - look for complete scholar objects
const scholarBlocks = content.split(/(?=\s+\{\s+id:\s*\d+,)/);

const eligible = [];

for (const block of scholarBlocks) {
  // Extract ID
  const idMatch = block.match(/id:\s*(\d+),/);
  if (!idMatch) continue;
  const id = parseInt(idMatch[1]);
  
  // Check status
  const statusMatch = block.match(/status:\s*'(active|on-hold|graduated)'/);
  if (!statusMatch) continue;
  const status = statusMatch[1];
  
  // Check for St. Augustine
  const isStAugustine = /isStAugustine:\s*true/.test(block);
  if (isStAugustine) continue;
  
  eligible.push({ id, status });
}

// Sort by ID
eligible.sort((a, b) => a.id - b.id);

console.log(`Found ${eligible.length} eligible scholars`);
console.log('Scholar IDs:', eligible.map(s => s.id).join(', '));

// Assign attendance patterns (70% excellent, 20% good, 10% at risk)
eligible.forEach((scholar, index) => {
  const rand = Math.random();
  if (rand < 0.7) scholar.pattern = 'excellent';
  else if (rand < 0.9) scholar.pattern = 'good';
  else scholar.pattern = 'atrisk';
  
  scholar.attendance = generateAttendance(scholar.pattern, scholar.status);
});

// Save result
fs.writeFileSync('attendance-data.json', JSON.stringify(eligible, null, 2));