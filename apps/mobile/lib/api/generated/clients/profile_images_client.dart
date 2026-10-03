// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import, invalid_annotation_target, unnecessary_import

import 'dart:convert';
import 'dart:io';

import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:retrofit/retrofit.dart';

import '../models/avatar.dart';

part 'profile_images_client.g.dart';

@RestApi()
abstract class ProfileImagesClient {
  factory ProfileImagesClient(Dio dio, {String? baseUrl}) =
      _ProfileImagesClient;

  /// Upload or replace your profile image (JPEG, PNG or WebP, max 2 MB)
  @MultiPart()
  @PUT('/api/v1/me/avatar')
  Future<Avatar> putApiV1MeAvatar({@Part(name: 'file') required File file});

  /// Remove your profile image
  @DELETE('/api/v1/me/avatar')
  Future<void> deleteApiV1MeAvatar();

  /// A profile image, or a redirect to its URL on the files domain
  @GET('/api/v1/avatars/{id}')
  @DioResponseType(ResponseType.stream)
  Stream<String> getApiV1AvatarsId({@Path('id') required String id});
}
