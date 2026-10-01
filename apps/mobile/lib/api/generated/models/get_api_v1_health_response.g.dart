// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'get_api_v1_health_response.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

GetApiV1HealthResponse _$GetApiV1HealthResponseFromJson(
  Map<String, dynamic> json,
) => GetApiV1HealthResponse(status: Status.fromJson(json['status'] as String));

Map<String, dynamic> _$GetApiV1HealthResponseToJson(
  GetApiV1HealthResponse instance,
) => <String, dynamic>{'status': _$StatusEnumMap[instance.status]!};

const _$StatusEnumMap = {Status.ok: 'ok', Status.$unknown: r'$unknown'};
