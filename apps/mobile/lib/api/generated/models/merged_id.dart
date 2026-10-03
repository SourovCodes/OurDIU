// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'merged_kind.dart';

part 'merged_id.g.dart';

@JsonSerializable()
class MergedId {
  const MergedId({
    required this.kind,
    required this.id,
    required this.mergedInto,
  });

  factory MergedId.fromJson(Map<String, Object?> json) =>
      _$MergedIdFromJson(json);

  final MergedKind kind;
  final int id;
  final int mergedInto;

  Map<String, Object?> toJson() => _$MergedIdToJson(this);
}
