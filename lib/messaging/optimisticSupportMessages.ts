export type OptimisticSupportMessage = {
  id: string;
  body: string;
  created_at: string;
  is_from_customer: boolean;
  senderLabel: string;
  baselineIds: string[];
};

export function pendingSupportMessages<
  T extends { id: string; body: string; is_from_customer: boolean },
>(serverMessages: T[], pending: OptimisticSupportMessage[]): OptimisticSupportMessage[] {
  const consumed = new Set<string>();
  return pending.filter((item) => {
    const baseline = new Set(item.baselineIds);
    const match = serverMessages.find(
      (message) =>
        !consumed.has(message.id) &&
        !baseline.has(message.id) &&
        message.body === item.body &&
        message.is_from_customer === item.is_from_customer,
    );
    if (!match) return true;
    consumed.add(match.id);
    return false;
  });
}
