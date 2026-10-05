// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Profile _$ProfileFromJson(Map<String, dynamic> json) => Profile(
  id: json['id'] as String,
  name: json['name'] as String,
  email: json['email'] as String,
  username: json['username'] as String,
  image: json['image'] as String?,
  studentId: json['studentId'] as String?,
  publishedCount: (json['publishedCount'] as num).toInt(),
  viewCount: (json['viewCount'] as num).toInt(),
  canContribute: json['canContribute'] as bool,
);

Map<String, dynamic> _$ProfileToJson(Profile instance) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'email': instance.email,
  'username': instance.username,
  'image': instance.image,
  'studentId': instance.studentId,
  'publishedCount': instance.publishedCount,
  'viewCount': instance.viewCount,
  'canContribute': instance.canContribute,
};
