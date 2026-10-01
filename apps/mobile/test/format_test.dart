import 'package:diuqbank/data/format.dart';
import 'package:diuqbank/theme/exam_shape.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('formats counts', () {
    expect(thousands(1220), '1,220');
    expect(thousands(999), '999');
    expect(compactCount(940), '940');
    expect(compactCount(6358), '6.4k');
    expect(compactCount(2000), '2k');
    expect(compactCount(12400), '12k');
    expect(plural(1, 'paper'), '1 paper');
    expect(plural(1220, 'paper'), '1,220 papers');
    expect(fileSize(272499), '266 KB');
    expect(fileSize(2400000), '2.3 MB');
    expect(shortDate(DateTime(2026, 9, 25, 12)), '25 Sep 2026');
  });

  test(
    'orders semesters newest first: year, then Fall, Summer, Spring, Short',
    () {
      final names = [
        'Spring 25',
        'Fall 24',
        'Short 25',
        'Summer 25',
        'Fall 25',
        'Spring 26',
      ]..sort(compareSemesters);
      expect(names, [
        'Spring 26',
        'Fall 25',
        'Summer 25',
        'Spring 25',
        'Short 25',
        'Fall 24',
      ]);
    },
  );

  test('gives each exam type a shape and letters', () {
    expect(examKind('Final'), ExamKind.finalExam);
    expect(examKind('Midterm'), ExamKind.midterm);
    expect(examKind('Quiz'), ExamKind.quiz);
    expect(examKind('Lab Final'), ExamKind.lab);
    expect(examKind('Lab Midterm'), ExamKind.lab);
    expect(examLetters('Final'), 'F');
    expect(examLetters('Lab Midterm'), 'LM');
    expect(examLetters('Class Test'), 'CT');
  });
}
