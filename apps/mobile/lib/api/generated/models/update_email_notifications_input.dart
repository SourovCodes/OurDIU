// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

part 'update_email_notifications_input.g.dart';

@JsonSerializable()
class UpdateEmailNotificationsInput {
  const UpdateEmailNotificationsInput({required this.emailNotifications});

  factory UpdateEmailNotificationsInput.fromJson(Map<String, Object?> json) =>
      _$UpdateEmailNotificationsInputFromJson(json);

  final bool emailNotifications;

  Map<String, Object?> toJson() => _$UpdateEmailNotificationsInputToJson(this);
}
