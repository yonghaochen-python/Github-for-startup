/**
 * The latest big update, shown on Home before and after logging in. To announce the next one, change this object
 * (and its id, so people who closed the old note see the new one).
 */
export const LATEST_UPDATE = {
  id: "layered-try-on-2026-10",
  title: "Try on a whole outfit, layer by layer",
  body: "Pick a coat, a sweater, a skirt and boots. Virm puts them all on your full-body photo at once, layered the way you'd wear them.",
  /** A full-body example photo (head to toe, facing forward). */
  photo: "/whats-new/full-body.jpg",
  pieces: [
    { src: "/sample/camel-coat.jpg", label: "Outer layer" },
    { src: "/sample/turtleneck.jpg", label: "Mid layer" },
    { src: "/sample/plaid-skirt.jpg", label: "Bottom" },
    { src: "/sample/knee-boots.jpg", label: "Shoes" },
  ],
};
