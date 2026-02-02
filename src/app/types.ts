// types.ts
export interface Lecture {
  id: number;
  title?: string; // Optional - displays "To Be Announced" if not present
  date?: string; // Optional - can be filled in later
  slidesLink?: string;
  recordingLink?: string;
}

export interface LectureGroup {
  title?: string; // Optional group title (e.g., "Weeks 1-4")
  lectures: Lecture[];
}

export interface Assignment {
  id: number;
  name: string;
  outDate: string;
  conceptual?: {
    title: string;
    link: string;
    inDate: string;
  };
  programming?: {
    title: string;
    link: string;
    inDate: string;
  };
}
