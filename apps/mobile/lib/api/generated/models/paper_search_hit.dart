// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'question_summary.dart';
import 'text_part.dart';

part 'paper_search_hit.g.dart';

@JsonSerializable()
class PaperSearchHit {
  const PaperSearchHit({
    required this.question,
    required this.submissionId,
    required this.snippet,
  });

  factory PaperSearchHit.fromJson(Map<String, Object?> json) =>
      _$PaperSearchHitFromJson(json);

  final QuestionSummary question;
  final int submissionId;
  final List<TextPart> snippet;

  Map<String, Object?> toJson() => _$PaperSearchHitToJson(this);
}
