import { Input } from "@/components/ui/input";
import type { QuestionComponentProps, FillInTheBlankQuestion as FITBQuestion } from "./types";

export default function FillInTheBlankQuestionComponent({ question, value, onChange, disabled }: QuestionComponentProps) {
  const q = question as FITBQuestion;
  const answers: string[] = value || q.correct_answers.map(() => "");

  // Split the question text by ___ to create segments
  const segments = q.question.split(/_{3,}/);

  const handleChange = (index: number, val: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = val;
    onChange(newAnswers);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-base leading-relaxed">
        {segments.map((segment, idx) => (
          <span key={idx} className="inline-flex items-center gap-2">
            <span>{segment}</span>
            {idx < segments.length - 1 && (
              <Input
                value={answers[idx] || ""}
                onChange={(e) => handleChange(idx, e.target.value)}
                disabled={disabled}
                className="inline-block w-40 h-9 text-center border-b-2 border-primary/50 rounded-none bg-transparent focus:border-primary"
                placeholder={`Lacuna ${idx + 1}`}
              />
            )}
          </span>
        ))}
      </div>
      {/* Hints removed - students should not see the answers */}
    </div>
  );
}
