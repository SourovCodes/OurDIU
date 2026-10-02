// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'review_message.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReviewMessage _$ReviewMessageFromJson(Map<String, dynamic> json) =>
    ReviewMessage(
      id: (json['id'] as num).toInt(),
      kind: ReviewMessageKind.fromJson(json['kind'] as String),
      body: json['body'] as String?,
      author: ReviewAuthor.fromJson(json['author'] as Map<String, dynamic>),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );

Map<String, dynamic> _$ReviewMessageToJson(ReviewMessage instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': _$ReviewMessageKindEnumMap[instance.kind]!,
      'body': instance.body,
      'author': instance.author,
      'createdAt': instance.createdAt.toIso8601String(),
    };

const _$ReviewMessageKindEnumMap = {
  ReviewMessageKind.comment: 'comment',
  ReviewMessageKind.changesRequested: 'changes_requested',
  ReviewMessageKind.rejected: 'rejected',
  ReviewMessageKind.published: 'published',
  ReviewMessageKind.returnedToReview: 'returned_to_review',
  ReviewMessageKind.detailsEdited: 'details_edited',
  ReviewMessageKind.fileReplaced: 'file_replaced',
  ReviewMessageKind.resubmitted: 'resubmitted',
  ReviewMessageKind.$unknown: r'$unknown',
};
