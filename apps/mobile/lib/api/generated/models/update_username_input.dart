// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_username_input.g.dart';

@JsonSerializable()
class UpdateUsernameInput {
  const UpdateUsernameInput({required this.username});

  factory UpdateUsernameInput.fromJson(Map<String, Object?> json) =>
      _$UpdateUsernameInputFromJson(json);

  final String username;

  Map<String, Object?> toJson() => _$UpdateUsernameInputToJson(this);
}
