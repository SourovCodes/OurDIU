// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'review_author.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ReviewAuthor _$ReviewAuthorFromJson(Map<String, dynamic> json) => ReviewAuthor(
  role: ReviewAuthorRole.fromJson(json['role'] as String),
  name: json['name'] as String?,
  image: json['image'] as String?,
);

Map<String, dynamic> _$ReviewAuthorToJson(ReviewAuthor instance) =>
    <String, dynamic>{
      'role': _$ReviewAuthorRoleEnumMap[instance.role]!,
      'name': instance.name,
      'image': instance.image,
    };

const _$ReviewAuthorRoleEnumMap = {
  ReviewAuthorRole.admin: 'admin',
  ReviewAuthorRole.uploader: 'uploader',
  ReviewAuthorRole.$unknown: r'$unknown',
};
