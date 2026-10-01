// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contributor_submission_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ContributorSubmissionList _$ContributorSubmissionListFromJson(
  Map<String, dynamic> json,
) => ContributorSubmissionList(
  items: (json['items'] as List<dynamic>)
      .map((e) => ContributorSubmission.fromJson(e as Map<String, dynamic>))
      .toList(),
  page: (json['page'] as num).toInt(),
  pageSize: (json['pageSize'] as num).toInt(),
  total: (json['total'] as num).toInt(),
);

Map<String, dynamic> _$ContributorSubmissionListToJson(
  ContributorSubmissionList instance,
) => <String, dynamic>{
  'items': instance.items,
  'page': instance.page,
  'pageSize': instance.pageSize,
  'total': instance.total,
};
