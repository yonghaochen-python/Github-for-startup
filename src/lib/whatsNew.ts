/**
 * The latest big update, shown on Home before and after logging in. To announce the next one, change this object
 * (and its id, so people who closed the old note see the new one).
 */
export const LATEST_UPDATE = {
  id: "layered-try-on-2026-10",
  title: "Photo virtual try-on",
  body: "Whole outfits, layered on your own photo.",
  /** A full-body example photo (head to toe, facing forward; Unsplash License) and a real Virm try-on of the pieces on it. */
  photo: "/whats-new/full-body.jpg",
  after: "/whats-new/after.jpg",
  pieces: [
    { src: "/sample/camel-coat.jpg", label: "Outer layer" },
    { src: "/sample/turtleneck.jpg", label: "Mid layer" },
    { src: "/sample/plaid-skirt.jpg", label: "Bottom" },
    { src: "/sample/knee-boots.jpg", label: "Shoes" },
  ],
};
