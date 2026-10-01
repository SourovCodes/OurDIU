// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'uploader.g.dart';

@JsonSerializable()
class Uploader {
  const Uploader({
    required this.id,
    required this.username,
    required this.name,
    required this.image,
  });

  factory Uploader.fromJson(Map<String, Object?> json) =>
      _$UploaderFromJson(json);

  final String id;
  final String username;
  final String name;
  final String? image;

  Map<String, Object?> toJson() => _$UploaderToJson(this);
}
