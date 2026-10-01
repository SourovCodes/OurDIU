import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'theme.dart';

/// Every exam type has a shape and a colour, so students can tell a Final from a
/// Quiz at a glance: a scalloped "cookie" for Finals, a four-leaf clover for
/// Midterms, a circle for Quizzes, a rounded square for lab exams.
enum ExamKind { finalExam, midterm, quiz, lab }

ExamKind examKind(String examType) => switch (examType) {
  'Final' => ExamKind.finalExam,
  'Midterm' => ExamKind.midterm,
  _ when examType.startsWith('Lab') => ExamKind.lab,
  _ => ExamKind.quiz,
};

/// The letters on the badge: "F", "M", "Q", "LF", "LM"; other types use their
/// initials.
String examLetters(String examType) => switch (examType) {
  'Final' => 'F',
  'Midterm' => 'M',
  'Quiz' => 'Q',
  _ =>
    examType
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .map((w) => w[0].toUpperCase())
        .take(2)
        .join(),
};

(Color, Color) examColors(BuildContext context, ExamKind kind) {
  final colors = ExamColors.of(context);
  return switch (kind) {
    ExamKind.finalExam => colors.finalExam,
    ExamKind.midterm => colors.midterm,
    ExamKind.quiz => colors.quiz,
    ExamKind.lab => colors.lab,
  };
}

/// The shape's outline, fitted to [size].
Path examPath(ExamKind kind, Size size) {
  final r = math.min(size.width, size.height) / 2;
  final center = size.center(Offset.zero);
  if (kind == ExamKind.lab) {
    return Path()..addRRect(
      RRect.fromRectAndRadius(
        Rect.fromCircle(center: center, radius: r * 0.92),
        Radius.circular(r * 0.4),
      ),
    );
  }
  double radius(double t) => switch (kind) {
    ExamKind.finalExam => r * (0.88 + 0.1 * math.cos(9 * t)),
    ExamKind.midterm => r * (0.76 + 0.2 * math.cos(4 * t + math.pi / 4)),
    _ => r * 0.96,
  };
  const steps = 120;
  final path = Path();
  for (var i = 0; i <= steps; i++) {
    final t = i / steps * 2 * math.pi;
    final point = center + Offset(math.cos(t), math.sin(t)) * radius(t);
    i == 0 ? path.moveTo(point.dx, point.dy) : path.lineTo(point.dx, point.dy);
  }
  return path..close();
}

class ExamShapePainter extends CustomPainter {
  const ExamShapePainter(this.kind, this.color);

  final ExamKind kind;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) =>
      canvas.drawPath(examPath(kind, size), Paint()..color = color);

  @override
  bool shouldRepaint(ExamShapePainter old) =>
      old.kind != kind || old.color != color;
}

/// The exam type's shape with its letters, e.g. a scalloped "F" for a Final.
class ExamBadge extends StatelessWidget {
  const ExamBadge(this.examType, {super.key, this.size = 44});

  final String examType;
  final double size;

  @override
  Widget build(BuildContext context) {
    final kind = examKind(examType);
    final (container, content) = examColors(context, kind);
    return Semantics(
      label: examType,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: size,
        child: CustomPaint(
          painter: ExamShapePainter(kind, container),
          child: Center(
            child: Text(
              examLetters(examType),
              textScaler: TextScaler.noScaling,
              style: expressive(
                size * 0.34,
                width: 120,
                weight: 800,
                color: content,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Just the shape, e.g. behind an empty state's icon or in a filter chip.
class ExamShape extends StatelessWidget {
  const ExamShape(this.kind, {super.key, required this.color, this.size = 16});

  final ExamKind kind;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) => SizedBox.square(
    dimension: size,
    child: CustomPaint(painter: ExamShapePainter(kind, color)),
  );
}
