export function validateImportRows(rows, { existingEmails, existingScholarIds }) {
  const seenEmails = new Set();
  const seenScholarIds = new Set();
  const seenNameSchool = new Set();

  return rows.map((row, index) => {
    const errors = [];
    const warnings = [];
    const email = (row.Email || '').trim().toLowerCase();
    const scholarId = (row['Scholar ID'] || '').trim();
    const firstName = (row['First Name'] || '').trim();
    const lastName = (row['Last Name'] || '').trim();
    const nameSchoolKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()}::${(row.School || '').trim().toLowerCase()}`;

    if (!firstName) errors.push('Missing First Name');
    if (!lastName) errors.push('Missing Last Name');
    if (!email) errors.push('Missing Email');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email format');
    if (!row.School) errors.push('Missing School');
    if (!row.Program) errors.push('Missing Program');
    if (!row['Year Level']) errors.push('Missing Year Level');
    if (Number(row['Active Scholarship Semesters']) < 1) errors.push('Active Scholarship Semesters must be at least 1');
    if (Number(row['Total Scholarship Semesters']) < Number(row['Active Scholarship Semesters'])) {
      errors.push('Total Scholarship Semesters must be >= Active Scholarship Semesters');
    }

    if (email && existingEmails.has(email)) errors.push('Email already has an account');
    if (email && seenEmails.has(email)) errors.push('Duplicate email within this file');
    if (scholarId && existingScholarIds.has(scholarId)) errors.push('Scholar ID already exists');
    if (scholarId && seenScholarIds.has(scholarId)) errors.push('Duplicate Scholar ID within this file');
    if (seenNameSchool.has(nameSchoolKey)) warnings.push('Possible duplicate: same name + school already in this file');

    seenEmails.add(email);
    seenScholarIds.add(scholarId);
    seenNameSchool.add(nameSchoolKey);

    return { index, row, errors, warnings, valid: errors.length === 0 };
  });
}
