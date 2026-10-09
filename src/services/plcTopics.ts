/** The factory namespace is shared by PLC ingestion and UNS discovery. */
export const PLC_NAMESPACE = "prplInnovationHub";
export const PLC_NAMESPACE_FILTER = `${PLC_NAMESPACE}/#`;

export function isFactoryTopic(topic: string): boolean {
  return topic === PLC_NAMESPACE || topic.startsWith(`${PLC_NAMESPACE}/`);
}
