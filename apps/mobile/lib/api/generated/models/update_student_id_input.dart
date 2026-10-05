// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_student_id_input.g.dart';

@JsonSerializable()
class UpdateStudentIdInput {
  const UpdateStudentIdInput({required this.studentId});

  factory UpdateStudentIdInput.fromJson(Map<String, Object?> json) =>
      _$UpdateStudentIdInputFromJson(json);

  final String? studentId;

  Map<String, Object?> toJson() => _$UpdateStudentIdInputToJson(this);
}
