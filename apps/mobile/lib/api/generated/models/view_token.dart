// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'view_token.g.dart';

@JsonSerializable()
class ViewToken {
  const ViewToken({required this.viewToken});

  factory ViewToken.fromJson(Map<String, Object?> json) =>
      _$ViewTokenFromJson(json);

  final String viewToken;

  Map<String, Object?> toJson() => _$ViewTokenToJson(this);
}
