// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'profile.g.dart';

@JsonSerializable()
class Profile {
  const Profile({
    required this.id,
    required this.name,
    required this.email,
    required this.username,
    required this.image,
    required this.publishedCount,
    required this.viewCount,
    required this.canContribute,
  });

  factory Profile.fromJson(Map<String, Object?> json) =>
      _$ProfileFromJson(json);

  final String id;
  final String name;
  final String email;
  final String username;
  final String? image;
  final int publishedCount;
  final int viewCount;
  final bool canContribute;

  Map<String, Object?> toJson() => _$ProfileToJson(this);
}
