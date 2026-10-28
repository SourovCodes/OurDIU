// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_room_usage.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AdminRoomUsage _$AdminRoomUsageFromJson(Map<String, dynamic> json) =>
    AdminRoomUsage(
      cycle: DateTime.parse(json['cycle'] as String),
      resetsOn: DateTime.parse(json['resetsOn'] as String),
      voiceBytes: (json['voiceBytes'] as num).toInt(),
      voiceSeconds: (json['voiceSeconds'] as num).toInt(),
      messages: (json['messages'] as num).toInt(),
      voiceBytesCap: (json['voiceBytesCap'] as num).toInt(),
      messagesCap: (json['messagesCap'] as num).toInt(),
      paused: json['paused'] as bool,
      enabled: json['enabled'] as bool,
      voiceAvailable: json['voiceAvailable'] as bool,
    );

Map<String, dynamic> _$AdminRoomUsageToJson(AdminRoomUsage instance) =>
    <String, dynamic>{
      'cycle': instance.cycle.toIso8601String(),
      'resetsOn': instance.resetsOn.toIso8601String(),
      'voiceBytes': instance.voiceBytes,
      'voiceSeconds': instance.voiceSeconds,
      'messages': instance.messages,
      'voiceBytesCap': instance.voiceBytesCap,
      'messagesCap': instance.messagesCap,
      'paused': instance.paused,
      'enabled': instance.enabled,
      'voiceAvailable': instance.voiceAvailable,
    };
