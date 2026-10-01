import { cn } from "~/lib/utils";

/**
 * Every exam type has a shape and a colour, as in the app
 * (apps/mobile/lib/theme/exam_shape.dart), so a Final and a Quiz can be told
 * apart at a glance: a scalloped "cookie" for Finals, a four-leaf clover for
 * Midterms, a circle for Quizzes, a rounded square for lab exams.
 */
export type ExamKind = "final" | "midterm" | "quiz" | "lab";

export function examKind(examType: string): ExamKind {
  if (examType === "Final") return "final";
  if (examType === "Midterm") return "midterm";
  if (examType.startsWith("Lab")) return "lab";
  return "quiz";
}

/** The letters on the badge: "F", "M", "Q", "LF", "LM"; other types use their initials. */
export function examLetters(examType: string): string {
  if (examType === "Final") return "F";
  if (examType === "Midterm") return "M";
  if (examType === "Quiz") return "Q";
  return examType
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

/** A closed outline around (50, 50) in a 100×100 box, radius as a function of angle. */
function polar(radius: (t: number) => number): string {
  const steps = 120;
  const points: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const r = radius(t);
    points.push(
      `${(50 + Math.cos(t) * r).toFixed(1)} ${(50 + Math.sin(t) * r).toFixed(1)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

const PATHS: Record<ExamKind, string> = {
  final: polar((t) => 50 * (0.88 + 0.1 * Math.cos(9 * t))),
  midterm: polar((t) => 50 * (0.76 + 0.2 * Math.cos(4 * t + Math.PI / 4))),
  quiz: "M2 50a48 48 0 1 0 96 0a48 48 0 1 0-96 0Z",
  lab: "M24 4h52a20 20 0 0 1 20 20v52a20 20 0 0 1-20 20H24A20 20 0 0 1 4 76V24A20 20 0 0 1 24 4Z",
};

const FILL: Record<ExamKind, string> = {
  final: "text-exam-final",
  midterm: "text-exam-midterm",
  quiz: "text-exam-quiz",
  lab: "text-exam-lab",
};

/** The content colour on an exam's shape, for letters or an icon. */
export const EXAM_INK: Record<ExamKind, string> = {
  final: "text-exam-final-foreground",
  midterm: "text-exam-midterm-foreground",
  quiz: "text-exam-quiz-foreground",
  lab: "text-exam-lab-foreground",
};

/** The exam's container colour as a background, with its content colour as text. */
export const EXAM_TONE: Record<ExamKind, string> = {
  final: "bg-exam-final text-exam-final-foreground",
  midterm: "bg-exam-midterm text-exam-midterm-foreground",
  quiz: "bg-exam-quiz text-exam-quiz-foreground",
  lab: "bg-exam-lab text-exam-lab-foreground",
};

/** Just the shape, in the exam's colour (or `currentColor` with `colored={false}`). */
export function ExamShape({
  kind,
  colored = true,
  className,
}: {
  kind: ExamKind;
  colored?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden
      className={cn("shrink-0", colored && FILL[kind], className)}
    >
      <path d={PATHS[kind]} fill="currentColor" />
    </svg>
  );
}

/** The exam type's shape with its letters, e.g. a scalloped "F" for a Final. */
export function ExamBadge({
  examType,
  size = 44,
  className,
}: {
  examType: string;
  /** Width and height in px. */
  size?: number;
  className?: string;
}) {
  const kind = examKind(examType);
  const letters = examLetters(examType);
  return (
    <span
      role="img"
      aria-label={examType}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <ExamShape kind={kind} className="absolute inset-0 size-full" />
      <span
        aria-hidden
        className={cn("relative font-display leading-none", EXAM_INK[kind])}
        style={{
          fontSize: Math.round(size * (letters.length > 1 ? 0.3 : 0.36)),
          fontStretch: "120%",
          fontWeight: 800,
        }}
      >
        {letters}
      </span>
    </span>
  );
}
