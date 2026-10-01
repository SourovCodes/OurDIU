// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_submission_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MySubmissionList _$MySubmissionListFromJson(Map<String, dynamic> json) =>
    MySubmissionList(
      items: (json['items'] as List<dynamic>)
          .map((e) => MySubmission.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$MySubmissionListToJson(MySubmissionList instance) =>
    <String, dynamic>{'items': instance.items};
