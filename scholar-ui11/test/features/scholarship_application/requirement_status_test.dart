import 'package:flutter_test/flutter_test.dart';
import 'package:iskonnectttt/features/scholarship_application/screens/scholarship_application_screen.dart';

// Attaching a file is not the same as submitting it. Uploading used to flip a
// requirement straight to "Submitted" — both in the applicant's UI and, via the
// persisted requirements map, on the CED admin's side — before the applicant
// ever pressed "Submit Application".
void main() {
  late ApplicationRequirementsNotifier notifier;

  setUp(() => notifier = ApplicationRequirementsNotifier());

  ApplicationRequirement byId(String id) =>
      notifier.state.firstWhere((r) => r.id == id);

  group('uploading a file', () {
    test('marks it Uploaded, not Submitted', () {
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);

      final req = byId('2');
      expect(req.status, RequirementStatus.uploaded);
      expect(req.status.label, 'Uploaded');
    });

    test('does not report the requirement as submitted to the admin', () {
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);

      final req = byId('2');
      expect(req.hasFile, isTrue, reason: 'the file is attached');
      expect(req.isSubmittedToAdmin, isFalse,
          reason: 'but it has not been sent yet');
    });

    test('does not stamp a submission time', () {
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);
      expect(byId('2').submittedAt, isNull);
    });

    test('still counts toward progress, so Submit can become available', () {
      // Otherwise the applicant could never reach 100% and could never submit.
      expect(notifier.requiredSubmittedCount, 0);
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);
      expect(notifier.requiredSubmittedCount, 1);
    });

    test('enables Submit only once every required file is attached', () {
      for (final r in notifier.state.where((r) => r.isRequired)) {
        expect(notifier.canSubmitApplication, isFalse);
        notifier.markAsUploaded(r.id, '${r.id}.pdf', fileSize: 10);
      }
      expect(notifier.canSubmitApplication, isTrue);
    });
  });

  group('pressing Submit Application', () {
    test('promotes uploaded files to Submitted', () {
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);
      notifier.markAsUploaded('3', 'form137.pdf', fileSize: 200);

      notifier.markUploadedAsSubmitted();

      expect(byId('2').status, RequirementStatus.submitted);
      expect(byId('3').status, RequirementStatus.submitted);
      expect(byId('2').status.label, 'Submitted');
    });

    test('is what finally reports them as submitted to the admin', () {
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);
      expect(byId('2').isSubmittedToAdmin, isFalse);

      notifier.markUploadedAsSubmitted();
      expect(byId('2').isSubmittedToAdmin, isTrue);
      expect(byId('2').submittedAt, isNotNull);
    });

    test('leaves untouched requirements alone', () {
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);
      notifier.markUploadedAsSubmitted();

      expect(byId('4').status, RequirementStatus.notSubmitted,
          reason: 'nothing was attached for requirement 4');
    });
  });

  group('replacing a file after the application is already with the admin', () {
    test('goes straight to Resubmitted, not back to Uploaded', () {
      // A rejected requirement is part of a live application; a correction has
      // to reach the evaluator without another full submit.
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);
      notifier.markUploadedAsSubmitted();
      notifier.updateStatus('2', RequirementStatus.rejected);

      notifier.markAsUploaded('2', 'id-v2.jpg', fileSize: 120);

      expect(byId('2').status, RequirementStatus.resubmitted);
      expect(byId('2').isSubmittedToAdmin, isTrue);
    });

    test('replacing an already-submitted file also resubmits', () {
      notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);
      notifier.markUploadedAsSubmitted();

      notifier.markAsUploaded('2', 'id-v2.jpg', fileSize: 120);

      expect(byId('2').status, RequirementStatus.resubmitted);
    });
  });

  group('reloading from the saved requirements map', () {
    test('restores an uploaded-but-unsent file', () {
      // Stored with submitted:false — it must still come back, or reopening
      // the screen would silently drop a file the applicant already attached.
      notifier.loadFromMap({
        'idPictures': {
          'submitted': false,
          'status': 'uploaded',
          'fileName': 'id.jpg',
        },
      });

      final req = byId('2');
      expect(req.status, RequirementStatus.uploaded);
      expect(req.fileName, 'id.jpg');
      expect(req.hasFile, isTrue);
    });

    test('still restores genuinely submitted files', () {
      notifier.loadFromMap({
        'idPictures': {
          'submitted': true,
          'status': 'submitted',
          'fileName': 'id.jpg',
        },
      });

      expect(byId('2').status, RequirementStatus.submitted);
      expect(byId('2').isSubmittedToAdmin, isTrue);
    });

    test('ignores an entry with neither a submission nor an upload', () {
      notifier.loadFromMap({
        'idPictures': {'submitted': false},
      });
      expect(byId('2').status, RequirementStatus.notSubmitted);
    });
  });

  test('removing a submission clears it back to Not submitted', () {
    notifier.markAsUploaded('2', 'id.jpg', fileSize: 100);
    notifier.removeSubmission('2');

    final req = byId('2');
    expect(req.status, RequirementStatus.notSubmitted);
    expect(req.fileName, isNull);
    expect(req.hasFile, isFalse);
  });
}
