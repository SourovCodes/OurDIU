// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'package:json_annotation/json_annotation.dart';

import 'status.dart';

part 'get_api_v1_health_response.g.dart';

@JsonSerializable()
class GetApiV1HealthResponse {
  const GetApiV1HealthResponse({required this.status});

  factory GetApiV1HealthResponse.fromJson(Map<String, Object?> json) =>
      _$GetApiV1HealthResponseFromJson(json);

  final Status status;

  Map<String, Object?> toJson() => _$GetApiV1HealthResponseToJson(this);
}
