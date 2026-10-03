// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'paper_search_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PaperSearchList _$PaperSearchListFromJson(Map<String, dynamic> json) =>
    PaperSearchList(
      items: (json['items'] as List<dynamic>)
          .map((e) => PaperSearchHit.fromJson(e as Map<String, dynamic>))
          .toList(),
      page: (json['page'] as num).toInt(),
      pageSize: (json['pageSize'] as num).toInt(),
      total: (json['total'] as num).toInt(),
    );

Map<String, dynamic> _$PaperSearchListToJson(PaperSearchList instance) =>
    <String, dynamic>{
      'items': instance.items,
      'page': instance.page,
      'pageSize': instance.pageSize,
      'total': instance.total,
    };
