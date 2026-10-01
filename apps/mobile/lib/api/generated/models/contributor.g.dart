// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contributor.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Contributor _$ContributorFromJson(Map<String, dynamic> json) => Contributor(
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
);

Map<String, dynamic> _$ContributorToJson(Contributor instance) =>
    <String, dynamic>{
      'id': instance.id,
      'username': instance.username,
      'name': instance.name,
      'image': instance.image,
      'joinedAt': instance.joinedAt.toIso8601String(),
      'publishedCount': instance.publishedCount,
      'viewCount': instance.viewCount,
      'departments': instance.departments,
    };
