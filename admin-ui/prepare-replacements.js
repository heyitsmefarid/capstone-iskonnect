import fs from 'fs';

const attendanceData = JSON.parse(fs.readFileSync('./attendance-data.json', 'utf8'));
const contextFile = fs.readFileSync('./src/context/AppContext.jsx', 'utf8');

// Generate attendance array string
function formatAttendance(attendance) {
  if (attendance.length === 0) return '[]';
  
  const lines = attendance.map(record => {
    return `      { activity: '${record.activity}', date: '${record.date}', present: ${record.present}, timeLogged: '${record.timeLogged}', loggedVia: '${record.loggedVia}' }`;
  });
  
  return `[\n${lines.join(',\n')},\n    ]`;
}

// For each scholar, prepare the replacement
const replacements = [];

for (const scholar of attendanceData) {
  const id = scholar.id;
  
  // Find the scholar block in the file
  const scholarPattern = new RegExp(`(\\s+\\{\\s+id:\\s*${id},[\\s\\S]*?attendance:\\s*)([\\s\\S]*?)(,\\s+grades:)`, 'm');
  const match = contextFile.match(scholarPattern);
  
  if (!match) {
    console.log(`Warning: Could not find scholar ${id}`);
    continue;
  }
  
  const before = match[1];
  const oldAttendance = match[2];
  const after = match[3];
  
  const newAttendance = formatAttendance(scholar.attendance);
  
  replacements.push({
    id: id,
    oldString: before + oldAttendance + after,
    newString: before + newAttendance + after
  });
}

console.log(`Generated ${replacements.length} replacements`);

// Save replacements for manual review
fs.writeFileSync('replacements.json', JSON.stringify(replacements.slice(0, 5), null, 2));
console.log('Saved first 5 replacements to replacements.json for review');

// Generate the actual update operations (split into batches)
const batchSize = 10;
const batches = [];

for (let i = 0; i < replacements.length; i += batchSize) {
  batches.push(replacements.slice(i, i + batchSize));
}

console.log(`Split into ${batches.length} batches of ${batchSize} replacements each`);

// Save batch info
fs.writeFileSync('batch-info.json', JSON.stringify({
  totalReplacements: replacements.length,
  batchSize: batchSize,
  numBatches: batches.length,
  scholarIds: attendanceData.map(s => s.id)
}, null, 2));

console.log('Done!');