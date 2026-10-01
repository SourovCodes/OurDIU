/** Who builds and runs the site, credited in the footer, on the home page and on /about. */
export const AUTHOR = {
  name: "Sourov Biswas",
  firstName: "Sourov",
  avatar: "/sourov.webp",
  /** Where bugs, ideas, removal and data requests go (/contact and the legal pages). */
  email: "sourov2305101004@diu.edu.bd",
  links: [
    {
      network: "linkedin",
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/sourov-biswas/",
    },
    {
      network: "facebook",
      label: "Facebook",
      href: "https://www.facebook.com/sourovb03",
    },
  ],
} as const;

export type SocialNetwork = (typeof AUTHOR.links)[number]["network"];
