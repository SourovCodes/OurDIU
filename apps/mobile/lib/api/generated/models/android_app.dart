// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'app_version.dart';

part 'android_app.g.dart';

@JsonSerializable()
class AndroidApp {
  const AndroidApp({required this.minVersion});

  factory AndroidApp.fromJson(Map<String, Object?> json) =>
      _$AndroidAppFromJson(json);

  final AppVersion minVersion;

  Map<String, Object?> toJson() => _$AndroidAppToJson(this);
}
