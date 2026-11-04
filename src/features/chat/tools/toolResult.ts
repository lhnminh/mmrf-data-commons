/** The runtime can hand a result over as JSON text or as the parsed object. */
export const parseResult = (result: unknown): unknown => {
  if (typeof result !== 'string') return result;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
};

/** Gateway names tools <target>___<tool>; people only need the tool. */
export const displayToolName = (toolName: string) => {
  const separator = toolName.indexOf('___');
  return separator < 0 ? toolName : toolName.slice(separator + 3);
};
