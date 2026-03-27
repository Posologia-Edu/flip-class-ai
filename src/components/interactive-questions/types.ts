export interface BaseQuestion {
  question: string;
  type: string;
  context?: string;
  correct_answer?: string;
  points?: number;
  hidden?: boolean;
  difficulty?: string;
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: "multiple_choice";
  options: string[];
  correct_answer: string;
}

export interface CaseStudyQuestion extends BaseQuestion {
  type: "case_study" | "open_ended";
  correct_answer: string;
}

export interface DragAndDropQuestion extends BaseQuestion {
  type: "drag_and_drop";
  items: string[];
  categories: string[];
  correct_mapping: Record<string, string>;
}

export interface FillInTheBlankQuestion extends BaseQuestion {
  type: "fill_in_the_blank";
  blanks: string[];
  correct_answers: string[];
}

export interface MatchingQuestion extends BaseQuestion {
  type: "matching";
  pairs: Array<{ left: string; right: string }>;
}

export interface OrderingQuestion extends BaseQuestion {
  type: "ordering";
  items: string[];
  correct_order: number[];
}

export type InteractiveQuestion =
  | MultipleChoiceQuestion
  | CaseStudyQuestion
  | DragAndDropQuestion
  | FillInTheBlankQuestion
  | MatchingQuestion
  | OrderingQuestion;

export interface QuestionComponentProps {
  question: InteractiveQuestion;
  value: any;
  onChange: (value: any) => void;
  disabled?: boolean;
}
