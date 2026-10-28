// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'room_voice_check.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RoomVoiceCheck _$RoomVoiceCheckFromJson(Map<String, dynamic> json) =>
    RoomVoiceCheck(
      ok: json['ok'] as bool,
      status: (json['status'] as num).toInt(),
      errorCode: json['errorCode'] as String?,
      message: json['message'] as String,
    );

Map<String, dynamic> _$RoomVoiceCheckToJson(RoomVoiceCheck instance) =>
    <String, dynamic>{
      'ok': instance.ok,
      'status': instance.status,
      'errorCode': instance.errorCode,
      'message': instance.message,
    };
