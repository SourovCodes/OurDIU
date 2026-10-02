import 'package:flutter_test/flutter_test.dart';
import 'package:diuqbank/router.dart';

void main() {
  String? open(String url) => webLinkLocation(Uri.parse(url));

  test('ourdiu.com links open the matching screen', () {
    expect(open('https://ourdiu.com/questions'), '/home');
    expect(open('https://ourdiu.com/questions/departments'), '/browse');
    expect(
      open('https://ourdiu.com/questions/departments/4'),
      '/browse/departments/4',
    );
    expect(
      open('https://ourdiu.com/questions/courses/12'),
      '/browse/courses/12',
    );
    expect(
      open('https://ourdiu.com/questions/browse?departmentId=1'),
      '/browse',
    );
    expect(open('https://ourdiu.com/questions/saved'), '/saved');
    expect(
      open('https://ourdiu.com/questions/contributors/ayesha'),
      '/home/contributors/ayesha',
    );
    expect(
      open('https://ourdiu.com/questions/my-submissions/7'),
      '/account/papers/7',
    );
    expect(open('https://ourdiu.com/questions/contribute'), '/account');
    expect(open('https://ourdiu.com/questions/something-new'), '/home');
  });

  test("a paper, and the app's own locations, stay as they are", () {
    expect(open('https://ourdiu.com/questions/123?submission=4'), isNull);
    expect(open('/home/courses/3'), isNull);
    expect(open('/browse'), isNull);
  });
}
