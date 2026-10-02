// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

@JsonEnum()
enum ReviewMessageKind {
  @JsonValue('comment')
  comment('comment'),
  @JsonValue('changes_requested')
  changesRequested('changes_requested'),
  @JsonValue('rejected')
  rejected('rejected'),
  @JsonValue('published')
  published('published'),
  @JsonValue('returned_to_review')
  returnedToReview('returned_to_review'),
  @JsonValue('details_edited')
  detailsEdited('details_edited'),
  @JsonValue('file_replaced')
  fileReplaced('file_replaced'),
  @JsonValue('resubmitted')
  resubmitted('resubmitted'),

  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const ReviewMessageKind(this.json);

  factory ReviewMessageKind.fromJson(String json) =>
      values.firstWhere((e) => e.json == json, orElse: () => $unknown);

  final String? json;

  @override
  String toString() => json?.toString() ?? super.toString();

  /// Returns all defined enum values excluding the $unknown value.
  static List<ReviewMessageKind> get $valuesDefined =>
      values.where((value) => value != $unknown).toList();
}
