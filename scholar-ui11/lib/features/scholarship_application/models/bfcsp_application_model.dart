/// Data model mirroring every field of the official BFCSP application form.
class BfcspApplicationModel {
  // ── Header ────────────────────────────────────────────────────────────
  String controlNumber;
  String applicationNumber;
  String rank;
  String academicYear;

  // ── Personal Information ───────────────────────────────────────────────
  String lastName;
  String firstName;
  String middleName;
  String nickname;
  String age;
  String dateOfBirth;
  String placeOfBirth;
  String sex;           // 'Male' | 'Female'
  String civilStatus;   // 'Single' | 'Married' | 'Others'
  String citizenship;
  String religion;
  String emailAddress;
  String facebookUsername;
  String contactNumbers;

  // ── Address ────────────────────────────────────────────────────────────
  String houseNo;
  String street;
  String subdivisionVillage;
  String barangay;
  String cityMunicipality;
  String province;

  // ── SHS & Special ──────────────────────────────────────────────────────
  String shsTrackStrand;
  String typeOfDisability;
  String ipAffiliation;
  String specialSkills;

  // ── Educational Background ─────────────────────────────────────────────
  String elementarySchool;
  String elementaryHonors;
  String jhsSchool;
  String jhsHonors;
  String shsSchool;
  String shsHonors;
  String shsGwaGrade11;
  String shsGwaGrade12;
  String gwa;
  String competitiveExamScore;

  // ── Family Background ──────────────────────────────────────────────────
  String parentsStatus;   // 'Together' | 'Separated'
  String fatherName;
  String fatherStatus;    // 'Living' | 'Deceased'
  String fatherContact;
  String fatherEducation;
  String fatherOccupation;
  String fatherIncome;
  String motherName;
  String motherMaidenName;
  String motherStatus;    // 'Living' | 'Deceased'
  String motherContact;
  String motherEducation;
  String motherOccupation;
  String motherIncome;
  String guardianName;
  String guardianContact;
  String guardianEducation;
  String guardianOccupation;
  String guardianIncome;
  String numberOfSiblings;
  List<SiblingEntry> siblings;
  bool isFourPs;
  String fourPsFrom;
  String fourPsTo;

  // ── Preferences ────────────────────────────────────────────────────────
  String preferredSchool;
  String preferredProgram1;
  String preferredProgram2;
  String preferredProgram3;

  // ── Additional Info ────────────────────────────────────────────────────
  bool hasOtherAssistance;
  List<OtherAssistanceEntry> otherAssistances;
  bool appliedOtherScholarship;
  List<OtherScholarshipEntry> otherScholarships;
  List<ClubMembershipEntry> clubMemberships;
  String essayAnswer;

  // ── Status ─────────────────────────────────────────────────────────────
  String status; // 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected'
  String? userId;
  String? savedAt;

  BfcspApplicationModel({
    this.controlNumber = '',
    this.applicationNumber = '',
    this.rank = '',
    this.academicYear = '2026-2027',
    this.lastName = '',
    this.firstName = '',
    this.middleName = '',
    this.nickname = '',
    this.age = '',
    this.dateOfBirth = '',
    this.placeOfBirth = '',
    this.sex = '',
    this.civilStatus = '',
    this.citizenship = 'Filipino',
    this.religion = '',
    this.emailAddress = '',
    this.facebookUsername = '',
    this.contactNumbers = '',
    this.houseNo = '',
    this.street = '',
    this.subdivisionVillage = '',
    this.barangay = '',
    this.cityMunicipality = 'Calapan City',
    this.province = 'Oriental Mindoro',
    this.shsTrackStrand = '',
    this.typeOfDisability = 'N/A',
    this.ipAffiliation = 'N/A',
    this.specialSkills = '',
    this.elementarySchool = '',
    this.elementaryHonors = '',
    this.jhsSchool = '',
    this.jhsHonors = '',
    this.shsSchool = '',
    this.shsHonors = '',
    this.shsGwaGrade11 = '',
    this.shsGwaGrade12 = '',
    this.gwa = '',
    this.competitiveExamScore = '',
    this.parentsStatus = '',
    this.fatherName = '',
    this.fatherStatus = 'Living',
    this.fatherContact = '',
    this.fatherEducation = '',
    this.fatherOccupation = '',
    this.fatherIncome = '',
    this.motherName = '',
    this.motherMaidenName = '',
    this.motherStatus = 'Living',
    this.motherContact = '',
    this.motherEducation = '',
    this.motherOccupation = '',
    this.motherIncome = '',
    this.guardianName = '',
    this.guardianContact = '',
    this.guardianEducation = '',
    this.guardianOccupation = '',
    this.guardianIncome = '',
    this.numberOfSiblings = '0',
    List<SiblingEntry>? siblings,
    this.isFourPs = false,
    this.fourPsFrom = '',
    this.fourPsTo = '',
    this.preferredSchool = '',
    this.preferredProgram1 = '',
    this.preferredProgram2 = '',
    this.preferredProgram3 = '',
    this.hasOtherAssistance = false,
    List<OtherAssistanceEntry>? otherAssistances,
    this.appliedOtherScholarship = false,
    List<OtherScholarshipEntry>? otherScholarships,
    List<ClubMembershipEntry>? clubMemberships,
    this.essayAnswer = '',
    this.status = 'draft',
    this.userId,
    this.savedAt,
  })  : siblings = siblings ?? List.generate(8, (_) => SiblingEntry()),
        otherAssistances = otherAssistances ?? [OtherAssistanceEntry(), OtherAssistanceEntry()],
        otherScholarships = otherScholarships ?? [OtherScholarshipEntry(), OtherScholarshipEntry()],
        clubMemberships = clubMemberships ?? [ClubMembershipEntry(), ClubMembershipEntry(), ClubMembershipEntry()];

  String get fullName => '$lastName, $firstName${middleName.isNotEmpty ? ' $middleName' : ''}';
  String get fullAddress => '$houseNo $street, $barangay, $cityMunicipality, $province';

  Map<String, dynamic> toMap() => {
    'controlNumber': controlNumber,
    'applicationNumber': applicationNumber,
    'rank': rank,
    'academicYear': academicYear,
    'lastName': lastName,
    'firstName': firstName,
    'middleName': middleName,
    'nickname': nickname,
    'age': age,
    'dateOfBirth': dateOfBirth,
    'placeOfBirth': placeOfBirth,
    'sex': sex,
    'civilStatus': civilStatus,
    'citizenship': citizenship,
    'religion': religion,
    'emailAddress': emailAddress,
    'facebookUsername': facebookUsername,
    'contactNumbers': contactNumbers,
    'houseNo': houseNo,
    'street': street,
    'subdivisionVillage': subdivisionVillage,
    'barangay': barangay,
    'cityMunicipality': cityMunicipality,
    'province': province,
    'shsTrackStrand': shsTrackStrand,
    'typeOfDisability': typeOfDisability,
    'ipAffiliation': ipAffiliation,
    'specialSkills': specialSkills,
    'elementarySchool': elementarySchool,
    'elementaryHonors': elementaryHonors,
    'jhsSchool': jhsSchool,
    'jhsHonors': jhsHonors,
    'shsSchool': shsSchool,
    'shsHonors': shsHonors,
    'shsGwaGrade11': shsGwaGrade11,
    'shsGwaGrade12': shsGwaGrade12,
    'gwa': gwa,
    'competitiveExamScore': competitiveExamScore,
    'parentsStatus': parentsStatus,
    'fatherName': fatherName,
    'fatherStatus': fatherStatus,
    'fatherContact': fatherContact,
    'fatherEducation': fatherEducation,
    'fatherOccupation': fatherOccupation,
    'fatherIncome': fatherIncome,
    'motherName': motherName,
    'motherMaidenName': motherMaidenName,
    'motherStatus': motherStatus,
    'motherContact': motherContact,
    'motherEducation': motherEducation,
    'motherOccupation': motherOccupation,
    'motherIncome': motherIncome,
    'guardianName': guardianName,
    'guardianContact': guardianContact,
    'guardianEducation': guardianEducation,
    'guardianOccupation': guardianOccupation,
    'guardianIncome': guardianIncome,
    'numberOfSiblings': numberOfSiblings,
    'siblings': siblings.map((s) => s.toMap()).toList(),
    'isFourPs': isFourPs,
    'fourPsFrom': fourPsFrom,
    'fourPsTo': fourPsTo,
    'preferredSchool': preferredSchool,
    'preferredProgram1': preferredProgram1,
    'preferredProgram2': preferredProgram2,
    'preferredProgram3': preferredProgram3,
    'hasOtherAssistance': hasOtherAssistance,
    'otherAssistances': otherAssistances.map((e) => e.toMap()).toList(),
    'appliedOtherScholarship': appliedOtherScholarship,
    'otherScholarships': otherScholarships.map((e) => e.toMap()).toList(),
    'clubMemberships': clubMemberships.map((e) => e.toMap()).toList(),
    'essayAnswer': essayAnswer,
    'status': status,
    'userId': userId,
    'savedAt': savedAt,
  };

  factory BfcspApplicationModel.fromMap(Map<String, dynamic> map) {
    return BfcspApplicationModel(
      controlNumber: map['controlNumber'] ?? '',
      applicationNumber: map['applicationNumber'] ?? '',
      rank: map['rank'] ?? '',
      academicYear: map['academicYear'] ?? '2026-2027',
      lastName: map['lastName'] ?? '',
      firstName: map['firstName'] ?? '',
      middleName: map['middleName'] ?? '',
      nickname: map['nickname'] ?? '',
      age: map['age'] ?? '',
      dateOfBirth: map['dateOfBirth'] ?? '',
      placeOfBirth: map['placeOfBirth'] ?? '',
      sex: map['sex'] ?? '',
      civilStatus: map['civilStatus'] ?? '',
      citizenship: map['citizenship'] ?? 'Filipino',
      religion: map['religion'] ?? '',
      emailAddress: map['emailAddress'] ?? '',
      facebookUsername: map['facebookUsername'] ?? '',
      contactNumbers: map['contactNumbers'] ?? '',
      houseNo: map['houseNo'] ?? '',
      street: map['street'] ?? '',
      subdivisionVillage: map['subdivisionVillage'] ?? '',
      barangay: map['barangay'] ?? '',
      cityMunicipality: map['cityMunicipality'] ?? 'Calapan City',
      province: map['province'] ?? 'Oriental Mindoro',
      shsTrackStrand: map['shsTrackStrand'] ?? '',
      typeOfDisability: map['typeOfDisability'] ?? 'N/A',
      ipAffiliation: map['ipAffiliation'] ?? 'N/A',
      specialSkills: map['specialSkills'] ?? '',
      elementarySchool: map['elementarySchool'] ?? '',
      elementaryHonors: map['elementaryHonors'] ?? '',
      jhsSchool: map['jhsSchool'] ?? '',
      jhsHonors: map['jhsHonors'] ?? '',
      shsSchool: map['shsSchool'] ?? '',
      shsHonors: map['shsHonors'] ?? '',
      shsGwaGrade11: map['shsGwaGrade11'] ?? '',
      shsGwaGrade12: map['shsGwaGrade12'] ?? '',
      gwa: map['gwa'] ?? '',
      competitiveExamScore: map['competitiveExamScore'] ?? '',
      parentsStatus: map['parentsStatus'] ?? '',
      fatherName: map['fatherName'] ?? '',
      fatherStatus: map['fatherStatus'] ?? 'Living',
      fatherContact: map['fatherContact'] ?? '',
      fatherEducation: map['fatherEducation'] ?? '',
      fatherOccupation: map['fatherOccupation'] ?? '',
      fatherIncome: map['fatherIncome'] ?? '',
      motherName: map['motherName'] ?? '',
      motherMaidenName: map['motherMaidenName'] ?? '',
      motherStatus: map['motherStatus'] ?? 'Living',
      motherContact: map['motherContact'] ?? '',
      motherEducation: map['motherEducation'] ?? '',
      motherOccupation: map['motherOccupation'] ?? '',
      motherIncome: map['motherIncome'] ?? '',
      guardianName: map['guardianName'] ?? '',
      guardianContact: map['guardianContact'] ?? '',
      guardianEducation: map['guardianEducation'] ?? '',
      guardianOccupation: map['guardianOccupation'] ?? '',
      guardianIncome: map['guardianIncome'] ?? '',
      numberOfSiblings: map['numberOfSiblings'] ?? '0',
      siblings: (map['siblings'] as List?)?.map((s) => SiblingEntry.fromMap(s)).toList(),
      isFourPs: map['isFourPs'] ?? false,
      fourPsFrom: map['fourPsFrom'] ?? '',
      fourPsTo: map['fourPsTo'] ?? '',
      preferredSchool: map['preferredSchool'] ?? '',
      preferredProgram1: map['preferredProgram1'] ?? '',
      preferredProgram2: map['preferredProgram2'] ?? '',
      preferredProgram3: map['preferredProgram3'] ?? '',
      hasOtherAssistance: map['hasOtherAssistance'] ?? false,
      otherAssistances: (map['otherAssistances'] as List?)?.map((e) => OtherAssistanceEntry.fromMap(e)).toList(),
      appliedOtherScholarship: map['appliedOtherScholarship'] ?? false,
      otherScholarships: (map['otherScholarships'] as List?)?.map((e) => OtherScholarshipEntry.fromMap(e)).toList(),
      clubMemberships: (map['clubMemberships'] as List?)?.map((e) => ClubMembershipEntry.fromMap(e)).toList(),
      essayAnswer: map['essayAnswer'] ?? '',
      status: map['status'] ?? 'draft',
      userId: map['userId'],
      savedAt: map['savedAt'],
    );
  }
}

class SiblingEntry {
  String name;
  String age;
  String gradeOrOccupation;
  SiblingEntry({ this.name = '', this.age = '', this.gradeOrOccupation = '' });
  Map<String, dynamic> toMap() => { 'name': name, 'age': age, 'gradeOrOccupation': gradeOrOccupation };
  factory SiblingEntry.fromMap(Map m) => SiblingEntry(name: m['name'] ?? '', age: m['age'] ?? '', gradeOrOccupation: m['gradeOrOccupation'] ?? '');
}

class OtherAssistanceEntry {
  String name;
  String donorInstitution;
  OtherAssistanceEntry({ this.name = '', this.donorInstitution = '' });
  Map<String, dynamic> toMap() => { 'name': name, 'donorInstitution': donorInstitution };
  factory OtherAssistanceEntry.fromMap(Map m) => OtherAssistanceEntry(name: m['name'] ?? '', donorInstitution: m['donorInstitution'] ?? '');
}

class OtherScholarshipEntry {
  String type;
  String granteeInstitution;
  OtherScholarshipEntry({ this.type = '', this.granteeInstitution = '' });
  Map<String, dynamic> toMap() => { 'type': type, 'granteeInstitution': granteeInstitution };
  factory OtherScholarshipEntry.fromMap(Map m) => OtherScholarshipEntry(type: m['type'] ?? '', granteeInstitution: m['granteeInstitution'] ?? '');
}

class ClubMembershipEntry {
  String organization;
  String designation;
  ClubMembershipEntry({ this.organization = '', this.designation = '' });
  Map<String, dynamic> toMap() => { 'organization': organization, 'designation': designation };
  factory ClubMembershipEntry.fromMap(Map m) => ClubMembershipEntry(organization: m['organization'] ?? '', designation: m['designation'] ?? '');
}
