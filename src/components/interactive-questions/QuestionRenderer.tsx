import type { InteractiveQuestion, QuestionComponentProps } from "./types";
import DragAndDropQuestionComponent from "./DragAndDropQuestion";
import FillInTheBlankQuestionComponent from "./FillInTheBlankQuestion";
import MatchingQuestionComponent from "./MatchingQuestion";
import OrderingQuestionComponent from "./OrderingQuestion";

interface QuestionRendererProps {
  question: InteractiveQuestion;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}

export function isInteractiveType(type: string): boolean {
  return ["drag_and_drop", "fill_in_the_blank", "matching", "ordering"].includes(type);
}

/**
 * Auto-grade interactive question types.
 * Returns a score between 0 and 1 (percentage correct).
 */
export function gradeInteractiveQuestion(question: InteractiveQuestion, answer: any): number {
  switch (question.type) {
    case "drag_and_drop": {
      const q = question as any;
      const mapping: Record<string, string> = answer || {};
      if (!q.correct_mapping || !q.items) return 0;
      let correct = 0;
      for (const item of q.items) {
        if (mapping[item] === q.correct_mapping[item]) correct++;
      }
      return q.items.length > 0 ? correct / q.items.length : 0;
    }
    case "fill_in_the_blank": {
      const q = question as any;
      const answers: string[] = answer || [];
      if (!q.correct_answers) return 0;
      let correct = 0;
      for (let i = 0; i < q.correct_answers.length; i++) {
        const expected = (q.correct_answers[i] || "").trim().toLowerCase();
        const given = (answers[i] || "").trim().toLowerCase();
        if (expected === given) correct++;
      }
      return q.correct_answers.length > 0 ? correct / q.correct_answers.length : 0;
    }
    case "matching": {
      const q = question as any;
      const matches: Record<string, string> = answer || {};
      if (!q.pairs) return 0;
      let correct = 0;
      for (const pair of q.pairs) {
        if (matches[pair.left] === pair.right) correct++;
      }
      return q.pairs.length > 0 ? correct / q.pairs.length : 0;
    }
    case "ordering": {
      const q = question as any;
      const order: string[] = answer || [];
      if (!q.correct_order || !q.items) return 0;
      const correctOrder = q.correct_order.map((i: number) => q.items[i]);
      let correct = 0;
      for (let i = 0; i < correctOrder.length; i++) {
        if (order[i] === correctOrder[i]) correct++;
      }
      return correctOrder.length > 0 ? correct / correctOrder.length : 0;
    }
    default:
      return 0;
  }
}

export default function QuestionRenderer({ question, value, onChange, disabled }: QuestionRendererProps) {
  switch (question.type) {
    case "drag_and_drop":
      return <DragAndDropQuestionComponent question={question} value={value} onChange={onChange} disabled={disabled} />;
    case "fill_in_the_blank":
      return <FillInTheBlankQuestionComponent question={question} value={value} onChange={onChange} disabled={disabled} />;
    case "matching":
      return <MatchingQuestionComponent question={question} value={value} onChange={onChange} disabled={disabled} />;
    case "ordering":
      return <OrderingQuestionComponent question={question} value={value} onChange={onChange} disabled={disabled} />;
    default:
      return null;
  }
}
