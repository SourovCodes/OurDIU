import 'dart:io';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_mlkit_document_scanner/google_mlkit_document_scanner.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';

import '../../api/api.dart';
import '../../api/generated/export.dart';
import '../../auth/token.dart';

/// The API's limit for one upload.
const maxPaperBytes = 20 * 1024 * 1024;

enum PaperSource { scan, files, shared }

/// A PDF ready to upload, copied into the app's own storage.
class PickedPdf {
  const PickedPdf({
    required this.path,
    required this.name,
    required this.bytes,
    required this.source,
    this.pages,
  });

  final String path;
  final String name;
  final int bytes;
  final PaperSource source;

  /// Null when the PDF couldn't be opened to count them.
  final int? pages;
}

/// Where papers come from: Android's document scanner or the file picker.
abstract interface class PaperSources {
  /// Null when the user backs out.
  Future<PickedPdf?> scan();
  Future<PickedPdf?> pick();
}

class DevicePaperSources implements PaperSources {
  @override
  Future<PickedPdf?> scan() async {
    final scanner = DocumentScanner(
      options: DocumentScannerOptions(
        documentFormats: {DocumentFormat.pdf},
        mode: ScannerMode.full,
        pageLimit: 30,
        isGalleryImport: true,
      ),
    );
    try {
      final pdf = (await scanner.scanDocument()).pdf;
      if (pdf == null) return null;
      final now = DateTime.now();
      return await _keep(
        File(pdf.uri.replaceFirst('file://', '')),
        'Scan ${now.day}-${now.month}-${now.year}.pdf',
        PaperSource.scan,
        pages: pdf.pageCount,
      );
    } on Exception catch (e) {
      // Closing the scanner is reported as an error.
      if ('$e'.contains('canceled') || '$e'.contains('cancelled')) return null;
      rethrow;
    } finally {
      await scanner.close();
    }
  }

  @override
  Future<PickedPdf?> pick() async {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
    );
    if (file == null) return null;
    final copy = await _uploadFile(file.name);
    await file.xFile.saveTo(copy.path);
    return _keep(copy, file.name, PaperSource.files);
  }
}

/// A fresh path in the app's upload folder, which only ever holds the latest
/// file.
Future<File> _uploadFile(String name) async {
  final dir = Directory('${(await getTemporaryDirectory()).path}/uploads');
  if (dir.existsSync()) dir.deleteSync(recursive: true);
  dir.createSync(recursive: true);
  final safe = name.replaceAll(RegExp(r'[\\/:*?"<>|]'), '');
  return File('${dir.path}/${safe.isEmpty ? 'paper.pdf' : safe}');
}

/// A PDF with its size and page count, from a file the app keeps.
Future<PickedPdf> _keep(
  File file,
  String name,
  PaperSource source, {
  int? pages,
}) async {
  var path = file.path;
  if (source == PaperSource.scan) {
    final copy = await _uploadFile(name);
    await file.copy(copy.path);
    path = copy.path;
  }
  return PickedPdf(
    path: path,
    name: name,
    bytes: await File(path).length(),
    source: source,
    pages: pages ?? await countPages(path),
  );
}

/// Pages of a PDF on disk; null if it can't be opened (the API then decides).
Future<int?> countPages(String path) async {
  try {
    final doc = await PdfDocument.openFile(path);
    final pages = doc.pages.length;
    await doc.dispose();
    return pages;
  } catch (_) {
    return null;
  }
}

final paperSourcesProvider = Provider<PaperSources>(
  (ref) => DevicePaperSources(),
);

/// Your papers, in every status: those a reviewer sent back first, then newest
/// first; null when signed out.
final myPapersProvider = FutureProvider<List<MySubmission>?>((ref) async {
  if (ref.watch(sessionTokenProvider) == null) return null;
  final list = await ref.watch(qbApiProvider).account.getApiV1MeSubmissions();
  int waiting(MySubmission s) =>
      s.status == SubmissionStatus.changesRequested ? 0 : 1;
  return [...list.items]..sort(
    (a, b) => waiting(a) != waiting(b)
        ? waiting(a) - waiting(b)
        : b.createdAt.compareTo(a.createdAt),
  );
});

/// How many of your papers need you (a reviewer asked for changes, or wrote
/// something you haven't read), for the Account tab's badge. 0 when signed
/// out or offline.
final reviewActivityProvider = FutureProvider<int>((ref) async {
  if (ref.watch(sessionTokenProvider) == null) return 0;
  try {
    final activity = await ref
        .watch(qbApiProvider)
        .account
        .getApiV1MeReviewActivity();
    return activity.needsAttention;
  } catch (_) {
    return 0;
  }
});

final myPaperProvider = FutureProvider.family<MySubmissionDetail, int>(
  (ref, id) => ref.watch(qbApiProvider).account.getApiV1MeSubmissionsId(id: id),
);

/// What a paper is filed under: an existing entry's id or a new name, like the
/// site's upload form.
class PaperDetails {
  const PaperDetails({
    this.departmentId,
    this.newDepartment,
    this.courseId,
    this.newCourse,
    this.semesterId,
    this.newSemester,
    this.examTypeId,
    this.section = '',
    this.batch = '',
  });

  final int? departmentId;
  final String? newDepartment;
  final int? courseId;
  final String? newCourse;
  final int? semesterId;
  final String? newSemester;
  final int? examTypeId;
  final String section;
  final String batch;

  bool get hasDepartment => departmentId != null || newDepartment != null;
  bool get complete =>
      hasDepartment &&
      (courseId != null || newCourse != null) &&
      (semesterId != null || newSemester != null) &&
      examTypeId != null;
  bool get proposesNew =>
      newDepartment != null || newCourse != null || newSemester != null;

  PaperDetails copyWith({
    (int?, String?)? department,
    (int?, String?)? course,
    (int?, String?)? semester,
    int? examTypeId,
    String? section,
    String? batch,
  }) => PaperDetails(
    departmentId: department == null ? departmentId : department.$1,
    newDepartment: department == null ? newDepartment : department.$2,
    courseId: course == null ? courseId : course.$1,
    newCourse: course == null ? newCourse : course.$2,
    semesterId: semester == null ? semesterId : semester.$1,
    newSemester: semester == null ? newSemester : semester.$2,
    examTypeId: examTypeId ?? this.examTypeId,
    section: section ?? this.section,
    batch: batch ?? this.batch,
  );

  /// As the API's fields: absent ones are left out.
  Map<String, Object> toFields() => {
    'examTypeId': examTypeId!,
    'departmentId': ?departmentId,
    'customDepartmentName': ?newDepartment,
    'courseId': ?courseId,
    'customCourseName': ?newCourse,
    'semesterId': ?semesterId,
    'customSemesterName': ?newSemester,
    if (section.trim().isNotEmpty) 'section': section.trim(),
    if (batch.trim().isNotEmpty) 'batch': batch.trim(),
  };

  ApiV1MeSubmissionsIdClassificationRequestBody toClassification() =>
      ApiV1MeSubmissionsIdClassificationRequestBody(
        departmentId: departmentId,
        customDepartmentName: newDepartment,
        courseId: courseId,
        customCourseName: newCourse,
        semesterId: semesterId,
        customSemesterName: newSemester,
        examTypeId: examTypeId!,
        section: section.trim().isEmpty ? null : section.trim(),
        batch: batch.trim().isEmpty ? null : batch.trim(),
      );

  /// A paper's current details, to edit them.
  static PaperDetails of(MySubmissionDetail s) {
    final c = s.classification;
    return PaperDetails(
      departmentId: c.department.id,
      newDepartment: c.department.id == null ? c.department.name : null,
      courseId: c.course.id,
      newCourse: c.course.id == null ? c.course.name : null,
      semesterId: c.semester.id,
      newSemester: c.semester.id == null ? c.semester.name : null,
      examTypeId: c.examType.id,
      section: s.section ?? '',
      batch: s.batch ?? '',
    );
  }
}

/// Uploads [pdf], reporting progress from 0 to 1.
Future<CreatedSubmission> uploadPaper(
  Dio dio,
  PickedPdf pdf,
  PaperDetails details, {
  void Function(double progress)? onProgress,
}) async {
  final form = FormData.fromMap({
    for (final MapEntry(:key, :value) in details.toFields().entries)
      key: '$value',
    'file': _pdfPart(pdf),
  });
  final res = await dio.post<Map<String, Object?>>(
    '/api/v1/submissions',
    data: form,
    onSendProgress: onProgress == null || form.length <= 0
        ? null
        : (sent, total) => onProgress(sent / (total > 0 ? total : 1)),
  );
  return CreatedSubmission.fromJson(res.data!);
}

/// Replaces the PDF of one of your papers, reporting progress from 0 to 1.
Future<MySubmissionDetail> replacePaperFile(
  Dio dio,
  int id,
  PickedPdf pdf, {
  void Function(double progress)? onProgress,
}) async {
  final form = FormData.fromMap({'file': _pdfPart(pdf)});
  final res = await dio.put<Map<String, Object?>>(
    '/api/v1/me/submissions/$id/file',
    data: form,
    onSendProgress: onProgress == null
        ? null
        : (sent, total) => onProgress(sent / (total > 0 ? total : 1)),
  );
  return MySubmissionDetail.fromJson(res.data!);
}

MultipartFile _pdfPart(PickedPdf pdf) => MultipartFile.fromFileSync(
  pdf.path,
  filename: pdf.name.toLowerCase().endsWith('.pdf')
      ? pdf.name
      : '${pdf.name}.pdf',
  contentType: DioMediaType('application', 'pdf'),
);

/// The message an API error carries, if any.
String? apiErrorMessage(Object error) => switch (error) {
  DioException(
    response: Response(data: {'error': {'message': final String m}}),
  ) =>
    m,
  _ => null,
};
