// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'uploader.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Uploader _$UploaderFromJson(Map<String, dynamic> json) => Uploader(
  id: json['id'] as String,
  username: json['username'] as String,
  name: json['name'] as String,
  image: json['image'] as String?,
);

Map<String, dynamic> _$UploaderToJson(Uploader instance) => <String, dynamic>{
  'id': instance.id,
  'username': instance.username,
  'name': instance.name,
  'image': instance.image,
};
