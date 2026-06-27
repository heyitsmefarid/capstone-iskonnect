// Shared BFCSP application-form PDF generator (server-side).
//
// Overlays an applicant's answers onto the real official template PDF
// (src/assets/bfcsp_application_form.pdf — which already contains the City /
// CED seals and the full layout), so the output is identical to the printed
// form. Both the admin web app and the Flutter scholar app call this through
// the `generateApplicationForm` HTTPS function, giving them one shared
// generator and pixel-identical output.
//
// Coordinates are measured from the template (US Letter, 612x792 pt, bottom-left
// origin — pdf-lib's native coordinate system). y values are text baselines.
// NOTE: keep this in sync with admin-ui/src/utils/bfcspApplicationForm.js.

const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const TEMPLATE_PATH = path.join(__dirname, '..', 'assets', 'bfcsp_application_form.pdf');
const INK = rgb(0.09, 0.09, 0.12);

let templateCache = null;
function loadTemplateBytes() {
  if (!templateCache) templateCache = fs.readFileSync(TEMPLATE_PATH);
  return templateCache;
}

const s = (v) => (v === null || v === undefined ? '' : String(v)).trim();

/** Normalise an arbitrary applicant record into the full set of BFCSP fields. */
function toBfcspFields(a = {}) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = a[k];
      if (v !== null && v !== undefined && String(v).trim() !== '') return String(v);
    }
    return '';
  };
  return {
    controlNumber: pick('controlNumber'),
    applicationNumber: pick('applicationNumber'),
    rank: pick('rank'),
    lastName: pick('lastName'),
    firstName: pick('firstName'),
    middleName: pick('middleName'),
    nickname: pick('nickname'),
    age: pick('age'),
    dateOfBirth: pick('dateOfBirth', 'birthDate'),
    placeOfBirth: pick('placeOfBirth'),
    sex: pick('sex', 'gender'),
    civilStatus: pick('civilStatus'),
    citizenship: pick('citizenship'),
    religion: pick('religion'),
    emailAddress: pick('emailAddress', 'email'),
    facebookUsername: pick('facebookUsername'),
    contactNumbers: pick('contactNumbers', 'phone'),
    houseNo: pick('houseNo'),
    street: pick('street'),
    subdivisionVillage: pick('subdivisionVillage'),
    barangay: pick('barangay'),
    cityMunicipality: pick('cityMunicipality', 'city'),
    province: pick('province'),
    address: pick('address'),
    shsTrackStrand: pick('shsTrackStrand'),
    typeOfDisability: pick('typeOfDisability'),
    ipAffiliation: pick('ipAffiliation'),
    specialSkills: pick('specialSkills'),
    elementarySchool: pick('elementarySchool'),
    elementaryHonors: pick('elementaryHonors'),
    jhsSchool: pick('jhsSchool'),
    jhsHonors: pick('jhsHonors'),
    shsSchool: pick('shsSchool'),
    shsHonors: pick('shsHonors'),
    gwa: pick('gwa'),
    competitiveExamScore: pick('competitiveExamScore'),
    parentsStatus: pick('parentsStatus'),
    fatherName: pick('fatherName'),
    fatherStatus: pick('fatherStatus'),
    fatherContact: pick('fatherContact'),
    fatherEducation: pick('fatherEducation'),
    fatherOccupation: pick('fatherOccupation'),
    fatherIncome: pick('fatherIncome'),
    motherName: pick('motherName'),
    motherMaidenName: pick('motherMaidenName'),
    motherStatus: pick('motherStatus'),
    motherContact: pick('motherContact'),
    motherEducation: pick('motherEducation'),
    motherOccupation: pick('motherOccupation'),
    motherIncome: pick('motherIncome'),
    guardianName: pick('guardianName'),
    guardianContact: pick('guardianContact'),
    guardianEducation: pick('guardianEducation'),
    guardianOccupation: pick('guardianOccupation'),
    guardianIncome: pick('guardianIncome'),
    numberOfSiblings: pick('numberOfSiblings'),
    siblings: Array.isArray(a.siblings) ? a.siblings : [],
    isFourPs: a.isFourPs === true,
    fourPsAnswered: typeof a.isFourPs === 'boolean',
    fourPsFrom: pick('fourPsFrom'),
    fourPsTo: pick('fourPsTo'),
    preferredSchool: pick('preferredSchool', 'school'),
    preferredProgram1: pick('preferredProgram1', 'program'),
    preferredProgram2: pick('preferredProgram2'),
    preferredProgram3: pick('preferredProgram3'),
    hasOtherAssistance: a.hasOtherAssistance === true,
    otherAssistanceAnswered: typeof a.hasOtherAssistance === 'boolean',
    otherAssistances: Array.isArray(a.otherAssistances) ? a.otherAssistances : [],
    appliedOtherScholarship: a.appliedOtherScholarship === true,
    otherScholarshipAnswered: typeof a.appliedOtherScholarship === 'boolean',
    otherScholarships: Array.isArray(a.otherScholarships) ? a.otherScholarships : [],
    clubMemberships: Array.isArray(a.clubMemberships) ? a.clubMemberships : [],
    essayAnswer: pick('essayAnswer'),
  };
}

/**
 * Fill the official form for one applicant.
 * @param {object} applicant
 * @returns {Promise<Uint8Array>} PDF bytes
 */
async function fillBfcspForm(applicant) {
  const f = toBfcspFields(applicant);

  const pdf = await PDFDocument.load(loadTemplateBytes());
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [page1, page2] = pdf.getPages();

  const fit = (str, ft, size, maxWidth) => {
    if (ft.widthOfTextAtSize(str, size) <= maxWidth) return str;
    while (str.length > 1 && ft.widthOfTextAtSize(`${str}…`, size) > maxWidth) str = str.slice(0, -1);
    return `${str}…`;
  };
  const put = (page, text, x, y, { size = 8, bold = false, maxWidth } = {}) => {
    let str = s(text);
    if (!str) return;
    const ft = bold ? fontBold : font;
    if (maxWidth) str = fit(str, ft, size, maxWidth);
    page.drawText(str, { x, y, size, font: ft, color: INK });
  };
  const tick = (page, x, y, on) => {
    if (on) page.drawText('X', { x: x + 0.5, y: y + 0.5, size: 8, font: fontBold, color: INK });
  };
  const paragraph = (page, text, x, yTop, { size = 8, maxWidth, lineHeight = 11, maxLines = 8 } = {}) => {
    const str = s(text);
    if (!str) return;
    const words = str.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
    lines.slice(0, maxLines).forEach((ln, i) => {
      page.drawText(ln, { x, y: yTop - i * lineHeight, size, font, color: INK });
    });
  };

  // ── PAGE 1 ──
  put(page1, f.controlNumber, 150, 747);
  put(page1, f.applicationNumber, 150, 660);
  put(page1, f.rank, 150, 649);

  put(page1, f.lastName, 122, 597, { maxWidth: 110 });
  put(page1, f.firstName, 250, 597, { maxWidth: 110 });
  put(page1, f.middleName, 372, 597, { maxWidth: 110 });

  put(page1, f.nickname, 70, 586.6, { maxWidth: 160 });
  put(page1, f.age, 70, 573.2, { maxWidth: 80 });
  put(page1, f.dateOfBirth, 72, 559.9, { maxWidth: 150 });
  put(page1, f.placeOfBirth, 74, 546.4, { maxWidth: 150 });
  tick(page1, 120.5, 532.2, f.sex === 'Male');
  tick(page1, 154.4, 532.2, f.sex === 'Female');
  tick(page1, 120.5, 518.5, f.civilStatus === 'Single');
  tick(page1, 154.8, 518.5, f.civilStatus === 'Married');
  tick(page1, 193.7, 518.5, !!f.civilStatus && !['Single', 'Married'].includes(f.civilStatus));
  put(page1, f.citizenship, 66, 506.0, { maxWidth: 165 });
  put(page1, f.religion, 58, 492.7, { maxWidth: 175 });
  put(page1, f.emailAddress, 80, 479.2, { size: 7.5, maxWidth: 155 });
  put(page1, f.facebookUsername, 99, 465.5, { size: 7.5, maxWidth: 135 });

  put(page1, f.contactNumbers, 315, 586.9, { maxWidth: 270 });
  if (f.houseNo || f.street || f.subdivisionVillage) {
    put(page1, f.houseNo, 268, 560, { size: 7.5, maxWidth: 60 });
    put(page1, f.street, 333, 560, { size: 7.5, maxWidth: 60 });
    put(page1, f.subdivisionVillage, 400, 560, { size: 7.5, maxWidth: 85 });
  } else {
    put(page1, f.address, 268, 560, { size: 7.5, maxWidth: 220 });
  }
  put(page1, f.barangay, 256, 541, { size: 7.5, maxWidth: 60 });
  put(page1, f.cityMunicipality, 318, 541, { size: 7.5, maxWidth: 75 });
  put(page1, f.province, 403, 541, { size: 7.5, maxWidth: 85 });
  put(page1, f.shsTrackStrand, 343, 519.7, { size: 7.5, maxWidth: 245 });
  put(page1, f.typeOfDisability, 350, 506.4, { size: 7.5, maxWidth: 238 });
  put(page1, f.ipAffiliation, 334, 493.1, { size: 7.5, maxWidth: 254 });
  put(page1, f.specialSkills, 348, 472.8, { size: 7.5, maxWidth: 240 });

  put(page1, f.elementarySchool, 100, 415.6, { size: 7.5, maxWidth: 185 });
  put(page1, f.elementaryHonors, 292, 415.6, { size: 7, maxWidth: 75 });
  put(page1, f.jhsSchool, 100, 390.8, { size: 7.5, maxWidth: 185 });
  put(page1, f.jhsHonors, 292, 390.8, { size: 7, maxWidth: 75 });
  put(page1, f.shsSchool, 100, 378.5, { size: 7.5, maxWidth: 185 });
  put(page1, f.shsHonors, 292, 378.5, { size: 7, maxWidth: 75 });
  put(page1, f.gwa, 392, 390.5, { size: 7.5, maxWidth: 55 });
  put(page1, f.competitiveExamScore, 450, 378.8, { size: 7.5, maxWidth: 40 });

  tick(page1, 34.1, 344.0, f.parentsStatus === 'Together');
  tick(page1, 66.0, 344.0, f.parentsStatus === 'Separated');
  tick(page1, 141.8, 343.4, f.fatherStatus === 'Living');
  tick(page1, 178.2, 343.4, f.fatherStatus === 'Deceased');
  tick(page1, 268.4, 342.7, f.motherStatus === 'Living');
  tick(page1, 304.8, 342.7, f.motherStatus === 'Deceased');

  const motherDisplay = f.motherMaidenName
    ? `${f.motherName}${f.motherName ? ' ' : ''}(${f.motherMaidenName})`.trim()
    : f.motherName;
  const famRows = [
    [328.3, f.fatherName, motherDisplay, f.guardianName],
    [314.6, f.fatherContact, f.motherContact, f.guardianContact],
    [301.1, f.fatherEducation, f.motherEducation, f.guardianEducation],
    [287.2, f.fatherOccupation, f.motherOccupation, f.guardianOccupation],
    [273.2, f.fatherIncome, f.motherIncome, f.guardianIncome],
  ];
  for (const [y, fa, mo, gu] of famRows) {
    put(page1, fa, 145, y, { size: 7, maxWidth: 115 });
    put(page1, mo, 268, y, { size: 7, maxWidth: 130 });
    put(page1, gu, 403, y, { size: 7, maxWidth: 85 });
  }

  put(page1, f.numberOfSiblings, 42, 251, { size: 7.5, maxWidth: 45 });
  const sibY = [235.9, 222.0, 208.3, 195.0, 181.7, 168.4, 155.0, 141.5];
  f.siblings.slice(0, 8).forEach((sib, i) => {
    if (!sib) return;
    put(page1, sib.name, 140, sibY[i], { size: 7, maxWidth: 165 });
    put(page1, sib.age, 322, sibY[i], { size: 7, maxWidth: 50 });
    put(page1, sib.gradeOrOccupation, 382, sibY[i], { size: 7, maxWidth: 108 });
  });

  if (f.fourPsAnswered) {
    tick(page1, 42.0, 183.1, f.isFourPs);
    tick(page1, 73.6, 183.1, !f.isFourPs);
  }
  put(page1, f.fourPsFrom, 66, 156, { size: 7, maxWidth: 25 });
  put(page1, f.fourPsTo, 112, 156, { size: 7, maxWidth: 25 });

  put(page1, f.preferredSchool, 140, 117, { maxWidth: 350 });
  put(page1, f.preferredProgram1, 140, 103.5, { maxWidth: 350 });
  put(page1, f.preferredProgram2, 140, 91.2, { maxWidth: 350 });
  put(page1, f.preferredProgram3, 140, 78.8, { maxWidth: 350 });

  // ── PAGE 2 ──
  if (page2) {
    if (f.otherAssistanceAnswered) {
      tick(page2, 32.2, 733.4, f.hasOtherAssistance);
      tick(page2, 68.2, 733.4, !f.hasOtherAssistance);
    }
    const asstY = [710, 692];
    f.otherAssistances.slice(0, 2).forEach((e, i) => {
      if (!e) return;
      put(page2, e.name, 238, asstY[i], { size: 7.5, maxWidth: 105 });
      put(page2, e.donorInstitution, 353, asstY[i], { size: 7.5, maxWidth: 150 });
    });

    if (f.otherScholarshipAnswered) {
      tick(page2, 32.2, 668.9, f.appliedOtherScholarship);
      tick(page2, 68.2, 668.9, !f.appliedOtherScholarship);
    }
    const grantY = [645, 627];
    f.otherScholarships.slice(0, 2).forEach((e, i) => {
      if (!e) return;
      put(page2, e.type, 238, grantY[i], { size: 7.5, maxWidth: 105 });
      put(page2, e.granteeInstitution, 351, grantY[i], { size: 7.5, maxWidth: 150 });
    });

    const clubY = [603.4, 589.7, 576.0];
    f.clubMemberships.slice(0, 3).forEach((e, i) => {
      if (!e) return;
      put(page2, e.organization, 45, clubY[i], { size: 7.5, maxWidth: 270 });
      put(page2, e.designation, 330, clubY[i], { size: 7.5, maxWidth: 255 });
    });

    paragraph(page2, f.essayAnswer, 24, 548, { size: 8, maxWidth: 565, lineHeight: 11, maxLines: 8 });

    const printedName = [f.firstName, f.middleName, f.lastName].filter(Boolean).join(' ');
    put(page2, printedName, 40, 360, { size: 8, maxWidth: 150 });
  }

  return pdf.save();
}

module.exports = { fillBfcspForm, toBfcspFields };
