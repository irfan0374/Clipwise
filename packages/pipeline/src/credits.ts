/** Flash/Turbo models cost about half a credit per character; other models about one. */
export const creditsFor = (characters: number, model: string) =>
  Math.ceil(characters * (/flash|turbo/i.test(model) ? 0.5 : 1));
