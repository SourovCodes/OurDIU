// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'cover_page_member.g.dart';

@JsonSerializable()
class CoverPageMember {
  const CoverPageMember({required this.name, required this.id});

  factory CoverPageMember.fromJson(Map<String, Object?> json) =>
      _$CoverPageMemberFromJson(json);

  final String name;
  final String id;

  Map<String, Object?> toJson() => _$CoverPageMemberToJson(this);
}
