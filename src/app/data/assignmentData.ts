// data/assignmentData.ts
export const assignments = [
  {
    id: 1,
    name: "Assignment 1: Introduction and Mathematical Foundations",
    outDate: "2026-01-21",
    // Since this only has a conceptual part, we put the due date in conceptual:
    conceptual: {
      title: "Conceptual",
      link: "https://hackmd.io/@browndls26/BJBMhFIB-e",
      inDate: "2026-02-05",
    },
  },
  {
    id: 2,
    name: "Assignment 2: Introduction to Numpy and Tensorflow",
    outDate: "2026-01-28",
    programming: {
      title: "Stencil Notebook",
      link: "",
      inDate: "2026-02-05",
    },
  },
  {
    id: 3,
    name: "Assignment 3: BERAS",
    outDate: "2026-02-04",
    // This one has both conceptual and programming:
    conceptual: {
      title: "Conceptual",
      link: "",
      inDate: "2026-02-12",
    },
    programming: {
      title: "Programming",
      link: "",
      inDate: "2026-02-26",
    },
  },
  {
    id: 4,
    name: "Assignment 4: CNNS",
    outDate: "2026-02-25",
    // This one has both conceptual and programming:
    conceptual: {
      title: "Conceptual",
      link: "",
      inDate: "2026-03-05",
    },
    programming: {
      title: "Programming",
      link: "",
      inDate: "2026-03-12",
    },
  },
  {
    id: 5,
    name: "Assignment 5: Language Modeling",
    outDate: "2026-03-11",
    conceptual: {
      title: "Conceptual",
      link: "",
      inDate: "2026-03-19",
    },
    programming: {
      title: "Programming",
      link: "",
      inDate: "2026-03-26",
    },
  },
  {
    id: 6,
    name: "Assignment 6: Generative Modeling",
    outDate: "2026-03-25",
    programming: {
      title: "Programming",
      link: "",
      inDate: "2026-04-09",
    },
  },
  {
    id: 7,
    name: "Assignment 7: Reinforcement Learning",
    outDate: "2026-04-08",
    programming: {
      title: "Programming",
      link: "",
      inDate: "2026-04-23",
    },
  }
];
