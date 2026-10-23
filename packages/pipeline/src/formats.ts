// What each video format means for the script writer. Format values come from @clipwise/shared Formats.
export type VideoFormat = "promo" | "explainer" | "story" | "tips" | "recap" | "quote";

export const formatGuides: Record<VideoFormat, { guide: string; cta: string }> = {
  promo: {
    guide: `This is a product or service promo. Structure: hook that names the viewer's problem → what the product does for them (benefits, not specs) → one proof point → the offer and what to do next.
Only use facts that are in the topic. Never invent prices, discounts, ratings, customer numbers or awards; say "check the link for today's price" instead of a number.
Never invent social proof ("thousands of people use it", "best-selling", "loved by…"), percentages, guarantees, test results, durability claims or features the topic doesn't mention (e.g. for "a reusable notebook", don't add cloud sync, an app or "lasts for years"). When the topic gives few details, talk about the viewer's problem and the benefit the topic itself implies (reusable → less waste), and how it feels to use it. No "stat" scenes unless the number is in the topic.`,
    cta: 'Tell viewers what to do next, e.g. "Tap the link to try it today."',
  },
  explainer: {
    guide:
      "This is an explainer. Teach one idea step by step, from the question to a clear answer. Use well-established facts and plain words.",
    cta: 'e.g. "Follow for more explained in under a minute."',
  },
  story: {
    guide:
      "This is a short story. Structure: a hook with tension → build-up → a twist or payoff → a one-line takeaway. Use vivid, concrete moments. If the topic is a true event, stick to well-established facts; otherwise make it clearly a story, not news.",
    cta: 'e.g. "Follow for more stories like this."',
  },
  tips: {
    guide:
      'These are tips. After the hook, each scene is one numbered, practical tip the viewer can use today ("Tip 1: ..."). Keep every tip specific and safe.',
    cta: 'e.g. "Save this so you don\'t forget."',
  },
  recap: {
    guide:
      "This is a recap. Sum up the topic's most important points in order of importance, one per scene. Use only well-established facts and avoid exact dates or figures you are not certain of.",
    cta: 'e.g. "Follow to stay up to date."',
  },
  quote: {
    guide: `This is a quote video. If the topic is itself a quote or saying, that is THE quote: use it word for word as the hook (scene 0's narration) and as the title scene's on-screen text, then explain what it means and how to apply it today. If the topic only names a theme (e.g. "quotes about patience"), pick one well-known saying on that theme and use it the same way.
Never attribute words to a real person unless the quote is famous and certain; otherwise present it as a saying.`,
    cta: 'e.g. "Share this with someone who needs it today."',
  },
};

/** "Auto" length: short formats get 30s, ones that need room to explain or tell get 60s. */
export const autoLength = (format: VideoFormat): 30 | 60 =>
  format === "promo" || format === "tips" || format === "quote" ? 30 : 60;
