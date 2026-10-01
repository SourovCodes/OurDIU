// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'submissions_client.dart';

// dart format off

// **************************************************************************
// RetrofitGenerator
// **************************************************************************

// ignore_for_file: type=lint
// ignore_for_file: unnecessary_brace_in_string_interps,no_leading_underscores_for_local_identifiers,unused_element,unnecessary_string_interpolations,unused_element_parameter,avoid_unused_constructor_parameters,unreachable_from_main,avoid_redundant_argument_values

class _SubmissionsClient implements SubmissionsClient {
  _SubmissionsClient(this._dio, {this.baseUrl, this.errorLogger});

  final Dio _dio;

  String? baseUrl;

  final ParseErrorLogger? errorLogger;

  @override
  Future<CreatedSubmission> postApiV1Submissions({
    required int examTypeId,
    required File file,
    int? departmentId,
    String? customDepartmentName,
    String? customDepartmentShortName,
    int? courseId,
    String? customCourseName,
    int? semesterId,
    String? customSemesterName,
    String? section,
    String? batch,
  }) async {
    final _extra = <String, dynamic>{};
    final queryParameters = <String, dynamic>{};
    queryParameters.removeWhere((k, v) => v == null);
    final _headers = <String, dynamic>{};
    final _data = FormData();
    _data.fields.add(MapEntry('examTypeId', examTypeId.toString()));
    _data.files.add(
      MapEntry(
        'file',
        MultipartFile.fromFileSync(
          file.path,
          filename: file.path.split(Platform.pathSeparator).last,
        ),
      ),
    );
    if (departmentId != null) {
      _data.fields.add(MapEntry('departmentId', departmentId.toString()));
    }
    if (customDepartmentName != null) {
      _data.fields.add(MapEntry('customDepartmentName', customDepartmentName));
    }
    if (customDepartmentShortName != null) {
      _data.fields.add(
        MapEntry('customDepartmentShortName', customDepartmentShortName),
      );
    }
    if (courseId != null) {
      _data.fields.add(MapEntry('courseId', courseId.toString()));
    }
    if (customCourseName != null) {
      _data.fields.add(MapEntry('customCourseName', customCourseName));
    }
    if (semesterId != null) {
      _data.fields.add(MapEntry('semesterId', semesterId.toString()));
    }
    if (customSemesterName != null) {
      _data.fields.add(MapEntry('customSemesterName', customSemesterName));
    }
    if (section != null) {
      _data.fields.add(MapEntry('section', section));
    }
    if (batch != null) {
      _data.fields.add(MapEntry('batch', batch));
    }
    final _options = _setStreamType<CreatedSubmission>(
      Options(
            method: 'POST',
            headers: _headers,
            extra: _extra,
            contentType: 'multipart/form-data',
          )
          .compose(
            _dio.options,
            '/api/v1/submissions',
            queryParameters: queryParameters,
            data: _data,
          )
          .copyWith(baseUrl: _combineBaseUrls(_dio.options.baseUrl, baseUrl)),
    );
    final _result = await _dio.fetch<Map<String, Object?>>(_options);
    late CreatedSubmission _value;
    try {
      _value = CreatedSubmission.fromJson(_result.data!);
    } on Object catch (e, s) {
      errorLogger?.logError(e, s, _options, response: _result);
      rethrow;
    }
    return _value;
  }

  @override
  Stream<String> getApiV1SubmissionsIdFile({required int id}) async* {
    final _extra = <String, dynamic>{};
    final queryParameters = <String, dynamic>{};
    final _headers = <String, dynamic>{};
    const Map<String, dynamic>? _data = null;
    final _options = _setStreamType<String>(
      Options(
            method: 'GET',
            headers: _headers,
            extra: _extra,
            responseType: ResponseType.stream,
          )
          .compose(
            _dio.options,
            '/api/v1/submissions/${id}/file',
            queryParameters: queryParameters,
            data: _data,
          )
          .copyWith(baseUrl: _combineBaseUrls(_dio.options.baseUrl, baseUrl)),
    );
    final _result = _dio.fetch<ResponseBody>(_options);
    final _value = _result.asStream().asyncExpand(
      (response) => utf8.decoder.bind(response.data!.stream),
    );
    yield* _value;
  }

  RequestOptions _setStreamType<T>(RequestOptions requestOptions) {
    if (T != dynamic &&
        !(requestOptions.responseType == ResponseType.bytes ||
            requestOptions.responseType == ResponseType.stream)) {
      if (T == String) {
        requestOptions.responseType = ResponseType.plain;
      } else {
        requestOptions.responseType = ResponseType.json;
      }
    }
    return requestOptions;
  }

  String _combineBaseUrls(String dioBaseUrl, String? baseUrl) {
    if (baseUrl == null || baseUrl.trim().isEmpty) {
      return dioBaseUrl;
    }

    final url = Uri.parse(baseUrl);

    if (url.isAbsolute) {
      return url.toString();
    }

    return Uri.parse(dioBaseUrl).resolveUri(url).toString();
  }
}

// dart format on
