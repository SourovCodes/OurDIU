// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'contributor_list.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ContributorList _$ContributorListFromJson(Map<String, dynamic> json) =>
    ContributorList(
      items: (json['items'] as List<dynamic>)
          .map((e) => Contributor.fromJson(e as Map<String, dynamic>))
          .toList(),
      page: (json['page'] as num).toInt(),
      pageSize: (json['pageSize'] as num).toInt(),
      total: (json['total'] as num).toInt(),
    );

Map<String, dynamic> _$ContributorListToJson(ContributorList instance) =>
    <String, dynamic>{
      'items': instance.items,
      'page': instance.page,
      'pageSize': instance.pageSize,
      'total': instance.total,
    };
