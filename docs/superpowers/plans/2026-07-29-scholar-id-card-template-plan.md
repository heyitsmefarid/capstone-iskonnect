# Scholar ID Card Template Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded single-sided scholar ID card with an admin-configurable, two-sided flip card — admin manages the template (backgrounds, logos, mayor's signature) via a new System Settings tab; every scholar's own app renders their card (photo, name, school, program, QR, address, DOB, emergency contact) on top of the active template, with a tap-to-flip interaction.

**Architecture:** Extends existing code rather than replacing the architecture: `qr_code_screen.dart`'s hardcoded `_ScholarshipIdCard` is replaced by a new template-driven front/back widget pair; the admin side adds one new tab to the existing `SystemSettings.jsx` page plus one new `AppContext.jsx` state/function pair, following the exact same pattern already used for `schoolYears`/catalog items.

**Tech Stack:** Flutter/Dart + Riverpod (scholar-ui11), React + Firestore client SDK (admin-ui). No backend Cloud Function changes.

Full design rationale: `docs/superpowers/specs/2026-07-29-scholar-id-card-template-design.md`.

## Global Constraints

- **No Cloud Function work.** `updateSystemConfig`/`getSystemSettings` are gated by `authenticateRequest` (a real Firebase ID token), which the admin panel's anonymous session can never provide. Write directly to Firestore (`system_config/scholarIdCardTemplate`) from the admin client, exactly like the existing schools/programs catalog does — confirmed via `firestore.rules:206-210`, this collection already allows `signedIn()` write.
- **Font/color/size of dynamic fields is not admin-configurable.** Only background images, logos, mayor's signature/name are template-driven. Matches the reference design's typography; don't build a font/color editor — nothing asked for one.
- **Coordinates in this plan are relative (0–100% of card width/height)**, read by eye off the two reference images, not exact PSD pixel values — expect to nudge them slightly during implementation while comparing against the reference images side by side.
- **The scholar's own "signature" on the back is a typed name in a cursive/script font** — there is no signature-capture feature in this app; don't build one.
- **The blue box on the back reference image is the QR code slot.** If this turns out wrong during implementation, stop and confirm with the project owner rather than guessing a different meaning.
- Existing `_saveStudentToFirestoreSafely`, `_listenToStudentDoc`, `login()`, `register()` (all in `auth_provider.dart`) are untouched by this plan except for `updateProfile()`'s two new optional parameters (Task 1) — do not touch anything else in that file.

---

### Task 1: `StudentModel` + `updateProfile()` — emergency contact fields

**Files:**
- Modify: `scholar-ui11/lib/core/models/student_model.dart`
- Modify: `scholar-ui11/lib/features/auth/providers/auth_provider.dart` (`updateProfile()` method, ~line 714-763)
- Test: `scholar-ui11/test/core/models/student_model_test.dart` (extend existing file)

**Interfaces:**
- Produces: `StudentModel.emergencyContactName` (`String?`), `StudentModel.emergencyContactPhone` (`String?`) — nullable, threaded through constructor/`copyWith`/`toJson`/`fromJson`. `AuthNotifier.updateProfile({..., String? emergencyContactName, String? emergencyContactPhone})`.

- [ ] **Step 1: Read the current files**

Read `student_model.dart` in full and `auth_provider.dart`'s `updateProfile()` method (lines ~709-763) before editing — this file already has account-activation fields from a prior plan (`uid`, `mustChangePassword`, etc.); follow that exact same nullable-field pattern for the two new fields.

- [ ] **Step 2: Write the failing test**

Add to `student_model_test.dart`:

```dart
test('fromJson reads emergencyContactName/Phone when present', () {
  final json = {
    'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
    'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
    'province': 'Oriental Mindoro', 'gender': 'Female',
    'emergencyContactName': 'Juana Cruz', 'emergencyContactPhone': '0912-345-6789',
  };
  final model = StudentModel.fromJson(json);
  expect(model.emergencyContactName, 'Juana Cruz');
  expect(model.emergencyContactPhone, '0912-345-6789');
});

test('fromJson defaults emergencyContactName/Phone to null when absent', () {
  final json = {
    'firstName': 'Ana', 'lastName': 'Cruz', 'email': 'a@example.com',
    'street': 'Rizal St', 'barangay': 'Poblacion', 'city': 'Calapan',
    'province': 'Oriental Mindoro', 'gender': 'Female',
  };
  final model = StudentModel.fromJson(json);
  expect(model.emergencyContactName, isNull);
  expect(model.emergencyContactPhone, isNull);
});

test('copyWith updates emergencyContactName/Phone', () {
  final model = StudentModel(
    firstName: 'Ana', middleName: '', lastName: 'Cruz',
    street: 'Rizal St', barangay: 'Poblacion', city: 'Calapan',
    province: 'Oriental Mindoro', gender: 'Female', dateOfBirth: DateTime(2002, 5, 10),
    contactNumber: '09171234567', email: 'a@example.com',
    schoolName: 'MinSU', yearLevel: '2', academicProgram: 'BSIT',
    academicYear: '2025-2026', semester: '1st Semester',
  );
  final updated = model.copyWith(emergencyContactName: 'Juana Cruz', emergencyContactPhone: '0912-345-6789');
  expect(updated.emergencyContactName, 'Juana Cruz');
  expect(updated.emergencyContactPhone, '0912-345-6789');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `flutter test test/core/models/student_model_test.dart`
Expected: FAIL — fields don't exist yet.

- [ ] **Step 4: Implement the model changes**

In `student_model.dart`, add: `final String? emergencyContactName; final String? emergencyContactPhone;` as fields, matching constructor params (`this.emergencyContactName, this.emergencyContactPhone,`), `copyWith` entries, `toJson` entries (`'emergencyContactName': emergencyContactName, 'emergencyContactPhone': emergencyContactPhone,`), and `fromJson` entries (`emergencyContactName: json['emergencyContactName']?.toString(), emergencyContactPhone: json['emergencyContactPhone']?.toString(),`) — exact same pattern as the existing `uid`/`grantSchoolYear` nullable-String fields already in this file.

In `auth_provider.dart`'s `updateProfile()`, add two new optional named parameters (`String? emergencyContactName, String? emergencyContactPhone`) and thread them into the `state.student!.copyWith(...)` call, matching every other parameter already there.

- [ ] **Step 5: Run test to verify it passes**

Run: `flutter test test/core/models/student_model_test.dart`
Expected: PASS (all tests, including pre-existing ones)

- [ ] **Step 6: Commit**

```bash
git add scholar-ui11/lib/core/models/student_model.dart scholar-ui11/lib/features/auth/providers/auth_provider.dart scholar-ui11/test/core/models/student_model_test.dart
git commit -m "feat: add emergency contact fields to StudentModel and updateProfile"
```

---

### Task 2: Admin UI — ID Card Template management tab

**Files:**
- Modify: `admin-ui/src/context/AppContext.jsx` (new state + function)
- Modify: `admin-ui/src/pages/SystemSettings.jsx` (new tab)

**Interfaces:**
- Consumes: `uploadFile`/`isFileSizeAllowed` from `admin-ui/src/services/cloudinaryUpload.js`
- Produces: `useApp().idCardTemplate` (object or null), `useApp().saveIdCardTemplate(templateData)` (async function)

- [ ] **Step 1: Add Firestore-backed state to `AppContext.jsx`**

Follow the exact same pattern as this file's other `onSnapshot`-backed singleton state (e.g. how `systemSettings` or `schoolYears` are loaded). Near the other `useState`/`useEffect` listener pairs:

```js
const [idCardTemplate, setIdCardTemplate] = useState(null);

useEffect(() => {
  const { db, isReady } = initializeFirebase();
  if (!isReady || !db) return;
  const unsub = onSnapshot(doc(db, 'system_config', 'scholarIdCardTemplate'), (snap) => {
    setIdCardTemplate(snap.exists() ? snap.data() : null);
  });
  return () => unsub();
}, []);

const saveIdCardTemplate = async (templateData) => {
  const { db, isReady } = initializeFirebase();
  if (!isReady || !db) return;
  await setDoc(
    doc(db, 'system_config', 'scholarIdCardTemplate'),
    { ...templateData, isActive: true, updatedAt: Date.now(), updatedBy: 'Admin' },
    { merge: true }
  );
};
```

Add `idCardTemplate` and `saveIdCardTemplate` to the context's exported value object (wherever the other state/functions are listed).

- [ ] **Step 2: Add the "ID Card Template" tab to `SystemSettings.jsx`**

Add to the `TABS` array: `{ id: 'idCardTemplate', label: 'ID Card Template', icon: CreditCard }` (import `CreditCard` from `lucide-react` alongside the other icon imports).

Add a helper to read an uploaded image's natural dimensions before uploading (needed for `frontAspectRatio`/`backAspectRatio`):

```js
function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = reject;
    img.src = url;
  });
}
```

Add local state for the five upload slots + mayor name, matching `idCardTemplate`'s existing saved values as the initial state (so re-opening the tab shows what's currently active):

```js
const [templateForm, setTemplateForm] = useState({
  frontBackgroundUrl: '', frontAspectRatio: null,
  backBackgroundUrl: '', backAspectRatio: null,
  mayorName: '', mayorSignatureUrl: '',
  primaryLogoUrl: '', secondaryLogoUrl: '',
});

useEffect(() => {
  if (idCardTemplate) setTemplateForm(prev => ({ ...prev, ...idCardTemplate }));
}, [idCardTemplate]);

const handleTemplateImageUpload = async (field, aspectField, file) => {
  if (!isFileSizeAllowed(file.size)) {
    Swal.fire({ icon: 'warning', title: 'File too large', text: `"${file.name}" is over the 10 MB limit.` });
    return;
  }
  const url = await uploadFile(file);
  if (!url) {
    Swal.fire({ icon: 'error', title: 'Upload failed', text: 'Could not upload the image.' });
    return;
  }
  const update = { [field]: url };
  if (aspectField) {
    const { width, height } = await readImageDimensions(file);
    update[aspectField] = width / height;
  }
  setTemplateForm(prev => ({ ...prev, ...update }));
};

const handleActivateTemplate = async () => {
  await saveIdCardTemplate(templateForm);
  Swal.fire({ icon: 'success', title: 'Template activated', timer: 1500, showConfirmButton: false });
};
```

Render the tab body (when `activeTab === 'idCardTemplate'`): a labeled file input for each of the five image slots (`frontBackgroundUrl` with `frontAspectRatio`, `backBackgroundUrl` with `backAspectRatio`, `mayorSignatureUrl` with no aspect field, `primaryLogoUrl` with no aspect field, `secondaryLogoUrl` with no aspect field — each calling `handleTemplateImageUpload(field, aspectField, e.target.files[0])` in its `onChange`), a text input bound to `templateForm.mayorName`, a small preview (`<img src={templateForm.frontBackgroundUrl} style={{maxWidth: 300}} />` and same for back) when a URL is set, and an "Activate Template" button calling `handleActivateTemplate`.

- [ ] **Step 3: Manual verification**

Run `npm run dev` in `admin-ui`, go to System Settings → ID Card Template, upload a test image for the front background, confirm the preview shows it and a computed aspect ratio appears in `templateForm` (log it or inspect via React DevTools), click Activate, and confirm in the Firebase console (or by re-loading the page) that `system_config/scholarIdCardTemplate` now has the expected fields.

- [ ] **Step 4: Commit**

```bash
git add admin-ui/src/context/AppContext.jsx admin-ui/src/pages/SystemSettings.jsx
git commit -m "feat: add ID card template management tab to System Settings"
```

---

### Task 3: Flutter — active template fetch + pure parsing

**Files:**
- Create: `scholar-ui11/lib/features/qr_code/models/id_card_template_model.dart`
- Create: `scholar-ui11/lib/features/qr_code/providers/id_card_template_provider.dart`
- Test: `scholar-ui11/test/features/qr_code/models/id_card_template_model_test.dart`

**Interfaces:**
- Produces: `IdCardTemplateModel.fromJson(Map<String, dynamic> json)` (pure, testable), `idCardTemplateProvider` (a Riverpod `FutureProvider<IdCardTemplateModel?>`) used by Tasks 4-5.

- [ ] **Step 1: Write the failing test for the pure model**

```dart
// scholar-ui11/test/features/qr_code/models/id_card_template_model_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';

void main() {
  test('fromJson parses all fields when present', () {
    final model = IdCardTemplateModel.fromJson({
      'frontBackgroundUrl': 'https://example.com/front.png',
      'frontAspectRatio': 1.6,
      'backBackgroundUrl': 'https://example.com/back.png',
      'backAspectRatio': 1.6,
      'mayorName': 'Atty. Doy C. Leachon',
      'mayorSignatureUrl': 'https://example.com/sig.png',
      'primaryLogoUrl': 'https://example.com/logo1.png',
      'secondaryLogoUrl': 'https://example.com/logo2.png',
    });
    expect(model.frontBackgroundUrl, 'https://example.com/front.png');
    expect(model.frontAspectRatio, 1.6);
    expect(model.mayorName, 'Atty. Doy C. Leachon');
  });

  test('fromJson defaults aspect ratios to a sane fallback when missing', () {
    final model = IdCardTemplateModel.fromJson({
      'frontBackgroundUrl': 'https://example.com/front.png',
      'backBackgroundUrl': 'https://example.com/back.png',
    });
    expect(model.frontAspectRatio, 1.6);
    expect(model.backAspectRatio, 1.6);
  });

  test('fromJson treats missing background URLs as null (no active template usable)', () {
    final model = IdCardTemplateModel.fromJson({});
    expect(model.frontBackgroundUrl, isNull);
    expect(model.backBackgroundUrl, isNull);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `flutter test test/features/qr_code/models/id_card_template_model_test.dart`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement the pure model**

```dart
// scholar-ui11/lib/features/qr_code/models/id_card_template_model.dart

/// The admin-configured ID card template (system_config/scholarIdCardTemplate).
/// A null [frontBackgroundUrl]/[backBackgroundUrl] means no template has been
/// activated yet — callers should fall back to a plain, template-less card.
class IdCardTemplateModel {
  final String? frontBackgroundUrl;
  final double frontAspectRatio;
  final String? backBackgroundUrl;
  final double backAspectRatio;
  final String? mayorName;
  final String? mayorSignatureUrl;
  final String? primaryLogoUrl;
  final String? secondaryLogoUrl;

  const IdCardTemplateModel({
    this.frontBackgroundUrl,
    this.frontAspectRatio = 1.6,
    this.backBackgroundUrl,
    this.backAspectRatio = 1.6,
    this.mayorName,
    this.mayorSignatureUrl,
    this.primaryLogoUrl,
    this.secondaryLogoUrl,
  });

  factory IdCardTemplateModel.fromJson(Map<String, dynamic> json) {
    return IdCardTemplateModel(
      frontBackgroundUrl: json['frontBackgroundUrl']?.toString(),
      frontAspectRatio: (json['frontAspectRatio'] as num?)?.toDouble() ?? 1.6,
      backBackgroundUrl: json['backBackgroundUrl']?.toString(),
      backAspectRatio: (json['backAspectRatio'] as num?)?.toDouble() ?? 1.6,
      mayorName: json['mayorName']?.toString(),
      mayorSignatureUrl: json['mayorSignatureUrl']?.toString(),
      primaryLogoUrl: json['primaryLogoUrl']?.toString(),
      secondaryLogoUrl: json['secondaryLogoUrl']?.toString(),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `flutter test test/features/qr_code/models/id_card_template_model_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement the provider (no automated test — thin Firestore-fetch wrapper)**

```dart
// scholar-ui11/lib/features/qr_code/providers/id_card_template_provider.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';

/// Fetched once per screen visit (not a live stream) — the template changes
/// rarely, and a scholar can just re-open the ID card screen to see an update.
final idCardTemplateProvider = FutureProvider<IdCardTemplateModel?>((ref) async {
  try {
    final doc = await FirebaseFirestore.instance
        .collection('system_config')
        .doc('scholarIdCardTemplate')
        .get()
        .timeout(const Duration(seconds: 5));
    if (!doc.exists) return null;
    final data = doc.data();
    if (data == null || data['isActive'] != true) return null;
    return IdCardTemplateModel.fromJson(data);
  } catch (_) {
    return null;
  }
});
```

- [ ] **Step 6: Manual verification**

With Task 2's admin flow having activated a template (or by manually writing a test doc to `system_config/scholarIdCardTemplate` in the Firebase console), confirm `ref.watch(idCardTemplateProvider)` in a throwaway debug print resolves to a populated `IdCardTemplateModel`. Also verify the no-active-template case (delete/deactivate the doc) resolves to `null` without throwing.

- [ ] **Step 7: Commit**

```bash
git add scholar-ui11/lib/features/qr_code/models/id_card_template_model.dart scholar-ui11/lib/features/qr_code/providers/id_card_template_provider.dart scholar-ui11/test/features/qr_code/models/id_card_template_model_test.dart
git commit -m "feat: add ID card template fetch provider and pure parsing model"
```

---

### Task 4: Flutter — front-side card widget

**Files:**
- Create: `scholar-ui11/lib/features/qr_code/widgets/id_card_front.dart`
- Modify: `scholar-ui11/lib/features/qr_code/screens/qr_code_screen.dart` (one rename only, Step 1)

**Interfaces:**
- Consumes: `IdCardTemplateModel` (Task 3), `StudentModel` (existing), `ProfileImage` widget (existing as private `_ProfileImage` in `qr_code_screen.dart:951` — renamed public in Step 1 so this new file can reuse it instead of duplicating the photo-loading/fallback-avatar logic).
- Produces: `IdCardFront` widget, consumed by Task 6.

- [ ] **Step 1: Make the existing profile-photo widget reusable**

`qr_code_screen.dart` already has exactly the photo-with-fallback-avatar widget this card needs: `_ProfileImage` (line ~951-990 — a private `StatelessWidget` that uses the already-public `profileImageProvider()` function internally, shows a navy initials avatar while loading/on error). Rename the class from `_ProfileImage` to `ProfileImage` (drop the leading underscore) and update its one call site (`ClipRRect(child: _ProfileImage(student: student))` in the old `_ScholarshipIdCard`) to match. It can keep referencing the file-private `_idNavy` color constant internally — only the class name needs to become public. Do not duplicate this logic in the new file.

- [ ] **Step 2: Build the widget**

```dart
// scholar-ui11/lib/features/qr_code/widgets/id_card_front.dart
import 'package:flutter/material.dart';
import 'package:iskonnectttt/core/models/student_model.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';
import 'package:iskonnectttt/features/qr_code/screens/qr_code_screen.dart' show ProfileImage;

/// Front of the templated scholar ID card: admin-configured background image
/// with the scholar's photo/name/school/program and the template's logo +
/// mayor's name/signature overlaid at fixed relative positions. Coordinates
/// below are approximate (read off the reference design by eye, not exact
/// PSD pixel values) — nudge them here if they drift from the reference
/// image during visual QA.
class IdCardFront extends StatelessWidget {
  final StudentModel student;
  final IdCardTemplateModel template;

  const IdCardFront({super.key, required this.student, required this.template});

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: template.frontAspectRatio,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;
          return Stack(
            children: [
              Positioned.fill(
                child: template.frontBackgroundUrl != null
                    ? Image.network(template.frontBackgroundUrl!, fit: BoxFit.cover)
                    : Container(color: Colors.grey.shade300),
              ),
              // Photo — left third of the card. Reuses the existing
              // photo-with-fallback-initials-avatar widget (Step 1).
              Positioned(
                left: w * 0.03, top: h * 0.18, width: w * 0.30, height: h * 0.74,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(w * 0.02),
                  child: ProfileImage(student: student),
                ),
              ),
              // Name.
              Positioned(
                left: w * 0.38, top: h * 0.33, width: w * 0.58, height: h * 0.19,
                child: FittedBox(
                  fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                  child: Text(student.fullName.toUpperCase(),
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 22, color: Color(0xFF1E3A5F))),
                ),
              ),
              // School + program.
              Positioned(
                left: w * 0.38, top: h * 0.52, width: w * 0.58, height: h * 0.16,
                child: FittedBox(
                  fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                  child: Text('${student.schoolName}\n${student.academicProgram}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
                ),
              ),
              // Secondary logo (bottom-left).
              if (template.secondaryLogoUrl != null)
                Positioned(
                  left: w * 0.02, top: h * 0.88, width: w * 0.30, height: h * 0.12,
                  child: Image.network(template.secondaryLogoUrl!, fit: BoxFit.contain),
                ),
              // Mayor's signature + name (bottom-right).
              Positioned(
                left: w * 0.68, top: h * 0.82, width: w * 0.30, height: h * 0.18,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    if (template.mayorSignatureUrl != null)
                      Expanded(child: Image.network(template.mayorSignatureUrl!, fit: BoxFit.contain)),
                    if (template.mayorName != null)
                      FittedBox(fit: BoxFit.scaleDown, child: Text(template.mayorName!,
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold))),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 3: Manual verification**

Temporarily render `IdCardFront` in place of the old `_ScholarshipIdCard` in `qr_code_screen.dart` (or in a scratch route) with a real activated template and a real logged-in student; visually compare against the reference front image and nudge the relative coordinates above if any element is noticeably off (photo overlapping text, name overflowing, etc.).

- [ ] **Step 4: Commit**

```bash
git add scholar-ui11/lib/features/qr_code/widgets/id_card_front.dart
git commit -m "feat: add templated ID card front-side widget"
```

---

### Task 5: Flutter — back-side card widget + emergency contact input

**Files:**
- Create: `scholar-ui11/lib/features/qr_code/widgets/id_card_back.dart`

**Interfaces:**
- Consumes: `IdCardTemplateModel` (Task 3), `StudentModel` (with Task 1's new fields), `qrDisplayData` (existing), `authStateProvider`/`updateProfile()` (existing + Task 1's extension)
- Produces: `IdCardBack` widget, consumed by Task 6.

- [ ] **Step 1: Build the widget**

```dart
// scholar-ui11/lib/features/qr_code/widgets/id_card_back.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:iskonnectttt/features/auth/providers/auth_provider.dart';
import 'package:iskonnectttt/features/qr_code/models/id_card_template_model.dart';

/// Back of the templated scholar ID card: personal information, emergency
/// contact (with an inline "add" affordance if missing), the scholar's QR
/// code, and their typed name in a script font as a signature stand-in (this
/// app has no signature-capture feature).
class IdCardBack extends ConsumerWidget {
  final IdCardTemplateModel template;

  const IdCardBack({super.key, required this.template});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final student = ref.watch(currentStudentProvider);
    if (student == null) return const SizedBox.shrink();

    return AspectRatio(
      aspectRatio: template.backAspectRatio,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final w = constraints.maxWidth;
          final h = constraints.maxHeight;
          final hasEmergencyContact = (student.emergencyContactName?.isNotEmpty ?? false) &&
              (student.emergencyContactPhone?.isNotEmpty ?? false);

          return Stack(
            children: [
              Positioned.fill(
                child: template.backBackgroundUrl != null
                    ? Image.network(template.backBackgroundUrl!, fit: BoxFit.cover)
                    : Container(color: Colors.grey.shade200),
              ),
              // Address.
              Positioned(
                left: w * 0.45, top: h * 0.33, width: w * 0.53, height: h * 0.09,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                    child: Text(student.fullAddress, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
              ),
              // Date of birth.
              Positioned(
                left: w * 0.45, top: h * 0.43, width: w * 0.53, height: h * 0.09,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                    child: Text('${student.dateOfBirth.month}/${student.dateOfBirth.day}/${student.dateOfBirth.year}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
              ),
              // Emergency contact — or an inline "add" affordance if missing.
              Positioned(
                left: w * 0.45, top: h * 0.53, width: w * 0.53, height: h * 0.17,
                child: hasEmergencyContact
                    ? FittedBox(
                        fit: BoxFit.scaleDown, alignment: Alignment.centerLeft,
                        child: Text('${student.emergencyContactName}\n${student.emergencyContactPhone}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      )
                    : InkWell(
                        onTap: () => _showAddEmergencyContactDialog(context, ref),
                        child: const Text('+ Add emergency contact',
                            style: TextStyle(fontSize: 11, color: Colors.blue, decoration: TextDecoration.underline)),
                      ),
              ),
              // Scholar's own name, script font, as a signature stand-in.
              Positioned(
                left: w * 0.45, top: h * 0.74, width: w * 0.53, height: h * 0.18,
                child: FittedBox(fit: BoxFit.scaleDown, alignment: Alignment.bottomLeft,
                    child: Text(student.fullName, style: const TextStyle(fontStyle: FontStyle.italic, fontSize: 16))),
              ),
              // QR code — the reference design's bottom-left placeholder slot.
              Positioned(
                left: w * 0.02, top: h * 0.82, width: w * 0.30, height: h * 0.16,
                child: QrImageView(data: student.qrDisplayData, backgroundColor: Colors.white),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showAddEmergencyContactDialog(BuildContext context, WidgetRef ref) {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Emergency Contact'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(controller: nameController, decoration: const InputDecoration(labelText: 'Name')),
            TextField(controller: phoneController, decoration: const InputDecoration(labelText: 'Phone Number')),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              ref.read(authStateProvider.notifier).updateProfile(
                    emergencyContactName: nameController.text.trim(),
                    emergencyContactPhone: phoneController.text.trim(),
                  );
              Navigator.pop(context);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 2: Manual verification**

Render `IdCardBack` in a scratch route or temporarily in `qr_code_screen.dart`; confirm the "+ Add emergency contact" link appears for a student with no emergency contact fields, that tapping it opens the dialog, and that saving updates the back of the card immediately (via the existing `currentStudentProvider` live-listener — no manual refresh needed). Confirm a student with both fields set shows them instead of the link.

- [ ] **Step 3: Commit**

```bash
git add scholar-ui11/lib/features/qr_code/widgets/id_card_back.dart
git commit -m "feat: add templated ID card back-side widget with emergency contact input"
```

---

### Task 6: Flutter — flip animation + integrate into `qr_code_screen.dart`

**Files:**
- Modify: `scholar-ui11/lib/features/qr_code/screens/qr_code_screen.dart`

**Interfaces:**
- Consumes: `IdCardFront` (Task 4), `IdCardBack` (Task 5), `idCardTemplateProvider` (Task 3)

- [ ] **Step 1: Read the current file in full**

Read `qr_code_screen.dart` completely before editing. **Keep `_ScholarshipIdCard` (and its private helpers `_IdInfoRow`/`_HeaderAccentPainter`/`_DotsPainter`) — do not delete them.** Step 3 below reuses `_ScholarshipIdCard` as the no-active-template fallback, so it must still exist and compile; you're only changing which widget is used as the *primary* card, not removing the old one.

- [ ] **Step 2: Add the flip wrapper widget**

```dart
/// Wraps [IdCardFront]/[IdCardBack] with a tap-triggered 3D Y-axis flip.
class _FlippableIdCard extends StatefulWidget {
  final Widget front;
  final Widget back;

  const _FlippableIdCard({required this.front, required this.back});

  @override
  State<_FlippableIdCard> createState() => _FlippableIdCardState();
}

class _FlippableIdCardState extends State<_FlippableIdCard> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 400),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _flip() {
    if (_controller.isAnimating) return;
    if (_controller.value == 0) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _flip,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final angle = _controller.value * 3.14159; // 0 to pi radians
          final showFront = angle <= 3.14159 / 2;
          final displayAngle = showFront ? angle : angle - 3.14159;
          return Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001) // perspective
              ..rotateY(displayAngle),
            child: showFront ? widget.front : widget.back,
          );
        },
      ),
    );
  }
}
```

- [ ] **Step 3: Wire it into the build method**

Replace the `RepaintBoundary(key: _idCardKey, child: _ScholarshipIdCard(student: student))` block with a `Consumer` (or convert the surrounding widget to read the provider) that watches `idCardTemplateProvider` and renders:

```dart
Consumer(
  builder: (context, ref, _) {
    final templateAsync = ref.watch(idCardTemplateProvider);
    return templateAsync.when(
      data: (template) {
        if (template == null || template.frontBackgroundUrl == null) {
          // No active template yet — fall back to the plain old card so the
          // screen never breaks for a scholar before the admin sets one up.
          return RepaintBoundary(key: _idCardKey, child: _ScholarshipIdCard(student: student));
        }
        return RepaintBoundary(
          key: _idCardKey,
          child: _FlippableIdCard(
            front: IdCardFront(student: student, template: template),
            back: IdCardBack(template: template),
          ),
        );
      },
      loading: () => const AspectRatio(aspectRatio: 1.6, child: Center(child: CircularProgressIndicator())),
      error: (_, __) => RepaintBoundary(key: _idCardKey, child: _ScholarshipIdCard(student: student)),
    );
  },
),
```

Add the necessary imports (`id_card_front.dart`, `id_card_back.dart`, `id_card_template_provider.dart`).

- [ ] **Step 4: Verify the download/share capture still works for either side**

`_downloadIdCard` already captures whatever is currently painted inside the `RepaintBoundary` keyed by `_idCardKey` — since the flip wrapper renders inside that same boundary, no change is needed there; it will naturally capture whichever side (front or back) is currently facing the viewer. Confirm this by hand-tracing `_downloadIdCard`'s boundary lookup against the new widget tree.

- [ ] **Step 5: Manual verification**

Run the app against a real or seeded student with an active template (from Task 2). Confirm: the card renders the front by default, tapping it flips to the back with a visible 3D rotation, tapping again flips back, and the Download button captures whichever side is currently showing. Also confirm the no-active-template fallback (temporarily deactivate/delete the template doc) still shows the old plain card without crashing.

- [ ] **Step 6: Commit**

```bash
git add scholar-ui11/lib/features/qr_code/screens/qr_code_screen.dart
git commit -m "feat: add tap-to-flip animation and wire templated ID card into QR screen"
```
