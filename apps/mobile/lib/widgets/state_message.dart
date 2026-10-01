import 'package:flutter/material.dart';

import '../theme/exam_shape.dart';
import '../theme/theme.dart';

/// Empty, offline and error states: an icon on one of the exam shapes, a title,
/// what to do next, and up to two actions.
class StateMessage extends StatelessWidget {
  const StateMessage({
    super.key,
    required this.icon,
    required this.title,
    required this.body,
    this.shape = ExamKind.finalExam,
    this.actions = const [],
  });

  final IconData icon;
  final String title;
  final String body;
  final ExamKind shape;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (container, content) = examColors(context, shape);
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: 14,
          children: [
            SizedBox.square(
              dimension: 132,
              child: CustomPaint(
                painter: ExamShapePainter(shape, container),
                child: Icon(icon, size: 52, color: content),
              ),
            ),
            Text(
              title,
              textAlign: TextAlign.center,
              style: expressive(
                22,
                width: 112,
                weight: 700,
                color: theme.colorScheme.onSurface,
              ).copyWith(height: 1.15),
            ),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 300),
              child: Text(
                body,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            if (actions.isNotEmpty)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                alignment: WrapAlignment.center,
                children: actions,
              ),
          ],
        ),
      ),
    );
  }
}
