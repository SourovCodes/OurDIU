// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contributor_detail.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ContributorDetail _$ContributorDetailFromJson(Map<String, dynamic> json) =>
    ContributorDetail(
      id: json['id'] as String,
      username: json['username'] as String,
      name: json['name'] as String,
      image: json['image'] as String?,
      joinedAt: DateTime.parse(json['joinedAt'] as String),
      publishedCount: (json['publishedCount'] as num).toInt(),
      viewCount: (json['viewCount'] as num).toInt(),
      departments: (json['departments'] as List<dynamic>)
          .map((e) => ContributorDepartment.fromJson(e as Map<String, dynamic>))
          .toList(),
      submissions: ContributorSubmissionList.fromJson(
        json['submissions'] as Map<String, dynamic>,
      ),
    );

Map<String, dynamic> _$ContributorDetailToJson(ContributorDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'username': instance.username,
      'name': instance.name,
      'image': instance.image,
      'joinedAt': instance.joinedAt.toIso8601String(),
      'publishedCount': instance.publishedCount,
      'viewCount': instance.viewCount,
      'departments': instance.departments,
      'submissions': instance.submissions,
    };
