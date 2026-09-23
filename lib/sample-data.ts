export type Memory = {
  id: string;
  title: string;
  dateLabel: string;
  place: string;
  story: string;
  people: string[];
  contributor: string;
  mediaType: "photo" | "video" | "mixed";
};

export const memories: Memory[] = [
  {
    id: "grandmas-graduation",
    title: "Grandma's Graduation",
    dateLabel: "1976",
    place: "California",
    story:
      "A placeholder for the story behind this photograph. Family members will be able to add what they remember, who was there, and why the moment mattered.",
    people: ["Grandma"],
    contributor: "Family Archive",
    mediaType: "photo"
  },
  {
    id: "the-california-years",
    title: "The California Years",
    dateLabel: "1980s",
    place: "California",
    story:
      "A collection of everyday moments, celebrations, and stories from the family's years in California.",
    people: ["Garcia Family"],
    contributor: "Family Archive",
    mediaType: "mixed"
  },
  {
    id: "our-hawaii-chapter",
    title: "Our Hawaii Chapter",
    dateLabel: "Today",
    place: "Hawaii",
    story:
      "The newest chapter of the Garcia family story, ready for photos, videos, voices, and memories as they happen.",
    people: ["Garcia Family"],
    contributor: "Julianne's Family",
    mediaType: "video"
  }
];
