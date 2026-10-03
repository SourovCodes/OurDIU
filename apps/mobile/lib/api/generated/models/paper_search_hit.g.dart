// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'paper_search_hit.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaperSearchHit _$PaperSearchHitFromJson(Map<String, dynamic> json) =>
    PaperSearchHit(
      question: QuestionSummary.fromJson(
        json['question'] as Map<String, dynamic>,
      ),
      submissionId: (json['submissionId'] as num).toInt(),
      snippet: (json['snippet'] as List<dynamic>)
          .map((e) => TextPart.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$PaperSearchHitToJson(PaperSearchHit instance) =>
    <String, dynamic>{
      'question': instance.question,
      'submissionId': instance.submissionId,
      'snippet': instance.snippet,
    };
