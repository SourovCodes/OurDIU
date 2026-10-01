import 'package:flutter/material.dart';

/// Placeholder blocks shaped like the content that's loading, with a soft
/// shimmer (still when the system asks for reduced motion).
class Skeleton extends StatefulWidget {
  const Skeleton({super.key, required this.child});

  final Widget child;

  @override
  State<Skeleton> createState() => _SkeletonState();
}

class _SkeletonState extends State<Skeleton>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    MediaQuery.disableAnimationsOf(context)
        ? _controller.stop()
        : _controller.repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      label: 'Loading',
      child: ExcludeSemantics(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) => ShaderMask(
            blendMode: BlendMode.srcATop,
            shaderCallback: (bounds) => LinearGradient(
              colors: [
                scheme.surfaceContainerHighest,
                scheme.surfaceContainerLow,
                scheme.surfaceContainerHighest,
              ],
              stops: const [0.35, 0.5, 0.65],
              begin: Alignment(-2 + 4 * _controller.value, 0),
              end: Alignment(-1 + 4 * _controller.value, 0),
            ).createShader(bounds),
            child: child,
          ),
          child: widget.child,
        ),
      ),
    );
  }
}

/// One placeholder block.
class Bone extends StatelessWidget {
  const Bone({super.key, this.width, required this.height, this.radius = 12});

  final double? width;
  final double height;
  final double radius;

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: height,
    decoration: BoxDecoration(
      color: Theme.of(context).colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(radius),
    ),
  );
}

/// A list row while it loads: badge, two lines of text.
class RowBone extends StatelessWidget {
  const RowBone({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: 8),
    child: Row(
      spacing: 14,
      children: [
        Bone(width: 44, height: 44, radius: 22),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: 6,
            children: [
              FractionallySizedBox(widthFactor: 0.8, child: Bone(height: 14)),
              FractionallySizedBox(widthFactor: 0.5, child: Bone(height: 12)),
            ],
          ),
        ),
      ],
    ),
  );
}
