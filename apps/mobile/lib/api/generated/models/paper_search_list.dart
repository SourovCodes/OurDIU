// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'paper_search_hit.dart';

part 'paper_search_list.g.dart';

@JsonSerializable()
class PaperSearchList {
  const PaperSearchList({
    required this.items,
    required this.page,
    required this.pageSize,
    required this.total,
  });

  factory PaperSearchList.fromJson(Map<String, Object?> json) =>
      _$PaperSearchListFromJson(json);

  final List<PaperSearchHit> items;
  final int page;
  final int pageSize;
  final int total;

  Map<String, Object?> toJson() => _$PaperSearchListToJson(this);
}
